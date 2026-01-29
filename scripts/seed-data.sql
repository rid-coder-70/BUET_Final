INSERT INTO products (id, product_id, product_name, stock_quantity, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'PROD-001', 'Gaming Console - PlayStation 5', 100, NOW(), NOW()),
  (gen_random_uuid(), 'PROD-002', 'Gaming Console - Xbox Series X', 75, NOW(), NOW()),
  (gen_random_uuid(), 'PROD-003', 'Gaming Console - Nintendo Switch', 150, NOW(), NOW()),
  (gen_random_uuid(), 'PROD-004', 'Gaming Laptop - ASUS ROG', 50, NOW(), NOW()),
  (gen_random_uuid(), 'PROD-005', 'Gaming Headset - SteelSeries', 200, NOW(), NOW())
ON CONFLICT (product_id) DO NOTHING;
