/**
 * MÓDULO 08 — REDES SOCIALES (Publicación Real)
 * Autor: Juan Rengifo | Futura Marketplace v3.0
 *
 * Integra: Facebook Graph API + Instagram Graph API + TikTok Content Posting API
 * Routes: POST /api/social/publish, GET /api/social/metrics/:postId
 */

const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { Pool } = require('pg');
const { eventBus, EVENTS } = require('../shared/eventBus');

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATION = `
CREATE TABLE IF NOT EXISTS social_posts (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES users(id),
  platform VARCHAR(20) CHECK (platform IN ('facebook','instagram','tiktok')),
  post_type VARCHAR(20) CHECK (post_type IN ('image','video','reel','text','story')),
  content TEXT,
  media_url TEXT,
  external_post_id VARCHAR(200),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// ══════════════════════════════════════════════════════════════════════════
// FACEBOOK
// ══════════════════════════════════════════════════════════════════════════
async function publishFacebook(vendorId, content, mediaUrl, postType) {
  const { rows: [vendor] } = await db.query(
    `SELECT fb_page_id, fb_access_token FROM users WHERE id = $1`, [vendorId]
  );
  if (!vendor?.fb_page_id) throw new Error('Facebook no vinculado');

  const pageId    = vendor.fb_page_id;
  const pageToken = vendor.fb_access_token;
  const baseUrl   = `https://graph.facebook.com/v18.0/${pageId}`;

  let result;
  if (postType === 'image' && mediaUrl) {
    // Subir imagen
    const upload = await axios.post(`${baseUrl}/photos`, {
      url: mediaUrl,
      message: content,
      access_token: pageToken,
    });
    result = upload.data;
  } else if (postType === 'video' || postType === 'reel') {
    // Video/Reel
    const upload = await axios.post(`${baseUrl}/videos`, {
      file_url: mediaUrl,
      description: content,
      access_token: pageToken,
    });
    result = upload.data;
  } else {
    // Solo texto
    const post = await axios.post(`${baseUrl}/feed`, {
      message: content,
      access_token: pageToken,
    });
    result = post.data;
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════════════
// INSTAGRAM (via Facebook Graph API)
// ══════════════════════════════════════════════════════════════════════════
async function publishInstagram(vendorId, content, mediaUrl, postType) {
  const { rows: [vendor] } = await db.query(
    `SELECT ig_account_id, fb_access_token FROM users WHERE id = $1`, [vendorId]
  );
  if (!vendor?.ig_account_id) throw new Error('Instagram no vinculado');

  const igId  = vendor.ig_account_id;
  const token = vendor.fb_access_token;
  const base  = `https://graph.facebook.com/v18.0/${igId}`;

  const mediaType = (postType === 'reel' || postType === 'video') ? 'REELS' : 'IMAGE';

  // Paso 1: Crear contenedor de media
  const container = await axios.post(`${base}/media`, {
    ...(mediaType === 'REELS' ? { video_url: mediaUrl } : { image_url: mediaUrl }),
    media_type: mediaType,
    caption: content,
    access_token: token,
  });

  // Paso 2: Publicar contenedor
  const publish = await axios.post(`${base}/media_publish`, {
    creation_id: container.data.id,
    access_token: token,
  });
  return publish.data;
}

// ══════════════════════════════════════════════════════════════════════════
// TIKTOK (Content Posting API)
// ══════════════════════════════════════════════════════════════════════════
async function publishTikTok(vendorId, content, mediaUrl) {
  const { rows: [vendor] } = await db.query(
    `SELECT tiktok_access_token, tiktok_open_id FROM users WHERE id = $1`, [vendorId]
  );
  if (!vendor?.tiktok_access_token) throw new Error('TikTok no vinculado');

  // Iniciar subida de video
  const init = await axios.post(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      post_info: { title: content.substring(0, 150), privacy_level: 'PUBLIC_TO_EVERYONE' },
      source_info: { source: 'PULL_FROM_URL', video_url: mediaUrl },
    },
    { headers: { Authorization: `Bearer ${vendor.tiktok_access_token}` } }
  );
  return init.data;
}

// ══════════════════════════════════════════════════════════════════════════
// PUBLICACIÓN UNIFICADA
// ══════════════════════════════════════════════════════════════════════════
router.post('/publish', async (req, res) => {
  const { platforms, content, media_url, post_type, scheduled_at } = req.body;
  const vendorId = req.user.id;
  const results  = [];

  for (const platform of (platforms || [])) {
    const { rows: [post] } = await db.query(`
      INSERT INTO social_posts (vendor_id, platform, post_type, content, media_url, scheduled_at, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [vendorId, platform, post_type || 'image', content, media_url,
        scheduled_at || null, scheduled_at ? 'scheduled' : 'pending']);

    if (!scheduled_at) {
      try {
        let externalId;
        if (platform === 'facebook')  externalId = (await publishFacebook(vendorId, content, media_url, post_type))?.id;
        if (platform === 'instagram') externalId = (await publishInstagram(vendorId, content, media_url, post_type))?.id;
        if (platform === 'tiktok')    externalId = (await publishTikTok(vendorId, content, media_url))?.data?.publish_id;

        await db.query(
          `UPDATE social_posts SET status='published', published_at=NOW(), external_post_id=$1 WHERE id=$2`,
          [externalId, post.id]
        );
        results.push({ platform, status: 'published', postId: post.id, externalId });
      } catch (err) {
        await db.query(`UPDATE social_posts SET status='failed' WHERE id=$1`, [post.id]);
        results.push({ platform, status: 'failed', error: err.message });
      }
    } else {
      results.push({ platform, status: 'scheduled', postId: post.id });
    }
  }
  res.json({ results });
});

// ── GET Métricas de un post ────────────────────────────────────────────────
router.get('/metrics/:postId', async (req, res) => {
  const { rows: [post] } = await db.query(
    `SELECT * FROM social_posts WHERE id = $1`, [req.params.postId]
  );
  if (!post) return res.status(404).json({ error: 'Post no encontrado' });

  // Obtener métricas reales de Facebook/Instagram
  if ((post.platform === 'facebook' || post.platform === 'instagram') && post.external_post_id) {
    try {
      const { rows: [vendor] } = await db.query(
        `SELECT fb_access_token FROM users WHERE id = $1`, [post.vendor_id]
      );
      const { data } = await axios.get(
        `https://graph.facebook.com/v18.0/${post.external_post_id}/insights`,
        { params: { metric: 'post_impressions,post_engagements,post_reactions_by_type_total', access_token: vendor.fb_access_token } }
      );
      await db.query(`UPDATE social_posts SET metrics=$1 WHERE id=$2`, [JSON.stringify(data), post.id]);
      return res.json({ ...post, metrics: data });
    } catch (e) {
      return res.json(post);
    }
  }
  res.json(post);
});

// ── GET Lista de posts del vendedor ───────────────────────────────────────
router.get('/posts', async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM social_posts WHERE vendor_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json(rows);
});

// Hook: publicar automáticamente nueva promoción en redes
eventBus.subscribe(EVENTS.PROMOTION_CREATED, async (promo) => {
  // Solo si el vendor tiene RRSS vinculadas
  const { rows: [v] } = await db.query(
    `SELECT fb_page_id, ig_account_id FROM users WHERE id=$1`, [promo.vendor_id]
  );
  if (!v?.fb_page_id) return;
  const content = `🎁 ${promo.title}\n${promo.description || ''}\n¡${promo.discount_value}% de descuento!`;
  try {
    await publishFacebook(promo.vendor_id, content, null, 'text');
    console.log(`[Social] Promoción publicada en Facebook para vendor ${promo.vendor_id}`);
  } catch (e) {
    console.error('[Social] Error publicando:', e.message);
  }
});

module.exports = { router, MIGRATION };
