-- USUARIOS (contrasena: password)
INSERT INTO users (name, email, password_hash, role, phone, status) VALUES
('Administrador Futura', 'admin@futura.com',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN',     '999000001', 'ACTIVO'),
('Carlos Vendedor',      'vendedor@futura.com',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'VENDEDOR',  '999000002', 'ACTIVO'),
('Ana Compradora',       'comprador@futura.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'COMPRADOR', '999000003', 'ACTIVO')
ON CONFLICT (email) DO NOTHING;

-- PERFIL VENDEDOR (Carlos ya verificado)
INSERT INTO seller_profiles (user_id, business_name, ruc, machine_type, machine_model, production_capacity, location_city, bank_name, bank_account, verified, approved_at, approved_by, portfolio_desc, futura_client_since)
SELECT id, 'Imprenta Carlos SAC', '20123456789', 'Impresora Ecosolvente, DTF', 'Roland TrueVIS VG3-640', 500, 'Lima',
       'BCP', '19100012345678', TRUE, now(), 1, 'Especialistas en impresion de gran formato y transfer textil con 5 años de experiencia.', '2022-03-15'
FROM users WHERE email = 'vendedor@futura.com' ON CONFLICT DO NOTHING;

-- CATEGORIAS con comision
INSERT INTO categories (name, commission_rate) VALUES
('Impresoras Ecosolvente', 10.00),
('Impresoras UV',          10.00),
('Plotters de Corte',      10.00),
('Impresoras DTF',         10.00),
('Sublimacion',             8.00),
('Tintas y Suministros',    8.00),
('Servicio Tecnico',       12.00),
('Accesorios',             10.00);

-- PRODUCTOS
INSERT INTO products (seller_id, category_id, title, description, price, min_quantity, production_time_days, requires_design_file, materials_available, image_url)
SELECT 2, 1, 'Impresora Ecosolvente 1.60m', 'Impresora de gran formato ecosolvente 1.60m. Resolucion hasta 1440 dpi. Ideal para banners, lonas y vinilos.', 15900.00, 1, 7, FALSE, NULL, 'https://www.futuradigital.tech/a1.jpg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE title='Impresora Ecosolvente 1.60m');
INSERT INTO products (seller_id, category_id, title, description, price, min_quantity, production_time_days, requires_design_file, materials_available, image_url)
SELECT 2, 1, 'Roll Printer 3.20m', 'Impresora de rollo gran formato 3.20m. Maxima cobertura para proyectos publicitarios.', 22500.00, 1, 10, FALSE, NULL, 'https://www.futuradigital.tech/a8.jpg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE title='Roll Printer 3.20m');
INSERT INTO products (seller_id, category_id, title, description, price, min_quantity, production_time_days, requires_design_file, materials_available, image_url)
SELECT 2, 2, 'Impresora UV Flatbed', 'Impresora UV cama plana. Imprime sobre madera, vidrio, acrilico y cuero.', 12500.00, 1, 7, FALSE, NULL, 'https://www.futuradigital.tech/a7.jpg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE title='Impresora UV Flatbed');
INSERT INTO products (seller_id, category_id, title, description, price, min_quantity, production_time_days, requires_design_file, materials_available, image_url)
SELECT 2, 3, 'Plotter de Corte 60cm', 'Plotter de corte profesional 60cm. Compatible con vinilo y cartulina.', 3200.00, 1, 3, FALSE, NULL, 'https://www.futuradigital.tech/a3.jpg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE title='Plotter de Corte 60cm');
INSERT INTO products (seller_id, category_id, title, description, price, min_quantity, production_time_days, requires_design_file, materials_available, sizes_available, image_url)
SELECT 2, 4, 'Impresora DTF 30cm', 'Impresora DTF para transfer de alta calidad sobre telas.', 8900.00, 1, 5, FALSE, 'PET Film', '30cm,60cm', 'https://www.futuradigital.tech/a10.jpg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE title='Impresora DTF 30cm');
INSERT INTO products (seller_id, category_id, title, description, price, min_quantity, production_time_days, requires_design_file, image_url)
SELECT 2, 6, 'Kit de Tintas Ecosolvente 1L x4', 'Set 4 tintas ecosolvente CMYK 1 litro. Alta densidad de color.', 280.00, 1, 1, FALSE, 'https://www.futuradigital.tech/a1.jpg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE title='Kit de Tintas Ecosolvente 1L x4');
INSERT INTO products (seller_id, category_id, title, description, price, min_quantity, production_time_days, requires_design_file, image_url)
SELECT 2, 7, 'Mantenimiento Preventivo Impresora', 'Servicio tecnico de mantenimiento preventivo. Limpieza cabezales, calibracion.', 350.00, 1, 1, FALSE, 'https://www.futuradigital.tech/a8.jpg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE title='Mantenimiento Preventivo Impresora');
INSERT INTO products (seller_id, category_id, title, description, price, min_quantity, production_time_days, requires_design_file, image_url)
SELECT 2, 8, 'Cabezal Epson i3200', 'Cabezal original Epson i3200 para impresoras ecosolvente y DTF.', 1200.00, 1, 2, FALSE, 'https://www.futuradigital.tech/a7.jpg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE title='Cabezal Epson i3200');
INSERT INTO products (seller_id, category_id, title, description, price, min_quantity, production_time_days, requires_design_file, image_url)
SELECT 2, 6, 'Tintas DTF CMYK + White 500ml', 'Set completo tintas DTF incluyendo blanco de alta cobertura.', 180.00, 1, 1, FALSE, 'https://www.futuradigital.tech/a10.jpg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE title='Tintas DTF CMYK + White 500ml');
INSERT INTO products (seller_id, category_id, title, description, price, min_quantity, production_time_days, requires_design_file, image_url)
SELECT 2, 7, 'Reparacion de Cabezales', 'Diagnostico y reparacion de cabezales. Limpieza ultrasonica incluida.', 220.00, 1, 2, FALSE, 'https://www.futuradigital.tech/a3.jpg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE title='Reparacion de Cabezales');
INSERT INTO products (seller_id, category_id, title, description, price, min_quantity, production_time_days, requires_design_file, image_url)
SELECT 2, 8, 'Rollo PET Film DTF 30cm x 100m', 'Film PET para impresion DTF de 30cm x 100m. Alta adherencia.', 95.00, 1, 1, FALSE, 'https://www.futuradigital.tech/a1.jpg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE title='Rollo PET Film DTF 30cm x 100m');

-- ORDEN DE PRUEBA
INSERT INTO orders (buyer_id, total, status) VALUES (3, 15900.00, 'ENTREGADA');
INSERT INTO order_items (order_id, product_id, seller_id, quantity, price, commission, net)
VALUES (1, 1, 2, 1, 15900.00, 1590.00, 14310.00);
INSERT INTO payments (order_id, provider, provider_payment_id, status, amount, released_at)
VALUES (1, 'MP', 'SANDBOX-TEST-001', 'APPROVED', 15900.00, now());
INSERT INTO reviews (order_id, buyer_id, seller_id, rating, comment, quality_ok, on_time)
VALUES (1, 3, 2, 5, 'Excelente producto, muy buena calidad y entrega rapida.', TRUE, TRUE);
