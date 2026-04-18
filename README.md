================================================================
  FUTURA MARKETPLACE v3.0
  Plataforma B2B de Maquinaria Gráfica — Guía completa
================================================================

CREDENCIALES DE PRUEBA
  Admin:     admin@futura.com      / password
  Vendedor:  vendedor@futura.com   / password
  Comprador: comprador@futura.com  / password

================================================================
  PASO 1 — INSTALAR DOCKER DESKTOP
================================================================

1. Descargar: https://www.docker.com/products/docker-desktop/
2. Instalar y REINICIAR la PC
3. Abrir Docker Desktop y esperar que el ícono quede quieto
4. Verificar en PowerShell:
     docker --version
   (Debe mostrar: Docker version X.X.X)

================================================================
  PASO 2 — DESCOMPRIMIR EL PROYECTO
================================================================

Extraer el ZIP en el escritorio. Debe quedar:

  C:\Users\TuNombre\Desktop\marketplace_merged\
      backend\
      frontend\
      database\
      docker-compose.yml
      .env.example
      README.md

================================================================
  PASO 3 — CREAR EL ARCHIVO .ENV
================================================================

Abrir PowerShell en la carpeta marketplace_merged y ejecutar:

  copy .env.example .env
  notepad .env

Se abre el Bloc de notas. Reemplazar TODOS los valores:

  DB_PASSWORD=futura2026
  JWT_SECRET=futura_marketplace_secreto_muy_largo_2026_xyz
  MP_ACCESS_TOKEN=TEST-123456789
  AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
  AWS_SECRET_KEY=wJalrXUtnFEMI
  AWS_BUCKET=futura-marketplace
  AWS_REGION=us-east-1
  FRONTEND_URL=http://localhost:3000
  NEXT_PUBLIC_API_URL=http://localhost:3001
  BACKEND_URL=http://localhost:3001

Guardar con Ctrl+S y cerrar el Bloc de notas.

================================================================
  PASO 4 — LEVANTAR EL PROYECTO (primera vez)
================================================================

En PowerShell, dentro de la carpeta marketplace_merged:

  docker-compose up --build -d

IMPORTANTE: La primera vez tarda 8-15 minutos porque descarga
Node.js, PostgreSQL y compila el frontend.

Al terminar debes ver EXACTAMENTE esto:
  Container marketplace_merged-db-1       Healthy
  Container marketplace_merged-backend-1  Started
  Container marketplace_merged-frontend-1 Started

================================================================
  PASO 5 — ABRIR EN EL NAVEGADOR
================================================================

  http://localhost:3000

Si ves el catálogo de Futura, todo está funcionando.

================================================================
  PASO 6 — SI NO APARECEN PRODUCTOS (solo primera vez)
================================================================

Si el catálogo sale vacío, ejecutar:

  docker exec -i marketplace_merged-db-1 psql -U postgres -d futuradb < database\seed.sql

Luego recargar http://localhost:3000

================================================================
  COMANDOS PARA EL DÍA A DÍA
================================================================

Iniciar (después de apagar la PC):
  docker-compose up -d

Detener todo:
  docker-compose down

Ver si está corriendo:
  docker ps

Ver errores del backend:
  docker logs marketplace_merged-backend-1 --tail 30

Ver errores del frontend:
  docker logs marketplace_merged-frontend-1 --tail 30

Reiniciar un servicio específico:
  docker-compose restart backend
  docker-compose restart frontend

================================================================
  SOLUCIÓN DE PROBLEMAS
================================================================

--- PROBLEMA: "port is already allocated" ---
  netstat -ano | findstr :3000
  netstat -ano | findstr :3001
  taskkill /PID <numero> /F
  docker-compose up -d

--- PROBLEMA: Docker no responde ---
  wsl --shutdown
  (Esperar 15 segundos)
  (Abrir Docker Desktop manualmente)
  (Esperar 2 minutos a que esté listo)
  docker-compose up -d

--- PROBLEMA: Base de datos corrupta ---
  docker-compose down -v
  docker-compose up --build -d

--- PROBLEMA: Categorías duplicadas ---
  docker exec -i marketplace_merged-db-1 psql -U postgres -d futuradb -c "DELETE FROM categories a USING categories b WHERE a.id > b.id AND a.name = b.name;"

--- PROBLEMA: Error al publicar producto (precio) ---
  El precio máximo es S/ 99,999,999.99

================================================================
  FUNCIONALIDADES DEL SISTEMA
================================================================

COMPRADOR:
  ✅ Registro e inicio de sesión
  ✅ Catálogo con filtros (categoría, precio, búsqueda)
  ✅ Ver portafolio del vendedor con reseñas
  ✅ Solicitar cotización personalizada (con archivos AI/PDF/PSD)
  ✅ Comparar y aceptar cotizaciones
  ✅ Carrito multi-producto
  ✅ Pago con Mercado Pago (sandbox)
  ✅ Ver estado de producción en tiempo real
  ✅ Confirmar recepción del pedido
  ✅ Calificar al vendedor (1-5 estrellas)
  ✅ Reportar problemas / abrir disputa

VENDEDOR:
  ✅ Publicar productos con imagen, materiales y tamaños
  ✅ Ver solicitudes de cotización con archivos adjuntos
  ✅ Responder cotizaciones (precio + días + notas)
  ✅ Rechazar cotizaciones con motivo
  ✅ Ver órdenes con detalle de comisión y neto
  ✅ Actualizar estado de producción con fotos
  ✅ Marcar órdenes como enviadas con código de tracking

ADMINISTRADOR:
  ✅ Panel de comisiones (10% por venta)
  ✅ Gestión de usuarios (eliminar vendedores/compradores)
  ✅ Aprobar vendedores verificando compra de máquina
  ✅ Dashboard Power BI (4 pestañas: Overview, Revenue, Vendedores, Productos)
  ✅ Gestión de disputas (abrir, revisar, resolver)
  ✅ Informe detallado imprimible (PDF)

================================================================
  PARA EJECUTAR EN OTRA PC
================================================================

1. Instalar Docker Desktop en esa PC
2. Copiar la carpeta marketplace_merged completa
3. Seguir los pasos 3, 4, 5 y 6 de esta guía
   (No necesitas instalar Node.js, Python ni nada más)

================================================================
  PARA PRODUCCIÓN (publicar en internet)
================================================================

1. Contratar servidor con Ubuntu (DigitalOcean, AWS, etc.)
2. Instalar Docker en el servidor
3. Subir la carpeta marketplace_merged
4. Editar .env con:
   - FRONTEND_URL=https://tu-dominio.com
   - NEXT_PUBLIC_API_URL=https://api.tu-dominio.com
   - BACKEND_URL=https://api.tu-dominio.com
   - MP_ACCESS_TOKEN=APP_USR-... (token real de Mercado Pago)
5. Ejecutar: docker-compose up --build -d
6. Configurar dominio y SSL (certbot)

================================================================
(c) 2026 Futura Marketplace v3.0
Stack: Next.js 14 + Node.js + Express + PostgreSQL + Docker
================================================================
