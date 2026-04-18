const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadDir = '/app/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const name = `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
  }
});

const originalSingle = upload.single.bind(upload);
upload.single = (field) => {
  const middleware = originalSingle(field);
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) return next(err);
      if (req.file) {
        req.file.location = `http://localhost:3001/uploads/${req.file.filename}`;
      }
      next();
    });
  };
};

module.exports = upload;
