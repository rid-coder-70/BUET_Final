const request = require('supertest');
const app = require('../src/index');

describe('Inventory Service API', () => {
  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'healthy');
    });
  });

  beforeAll(async () => {
    // Seed test data
    const Product = require('../src/models/Product');
    await Product.sync({ alter: true }); // Ensure table exists
    
    await Product.findOrCreate({
      where: { productId: 'PROD-001' },
      defaults: {
        productId: 'PROD-001',
        productName: 'Test Product 1',
        stockQuantity: 100,
        price: 999.99
      }
    });

    await Product.findOrCreate({
      where: { productId: 'PROD-002' },
      defaults: {
        productId: 'PROD-002',
        productName: 'Test Product 2',
        stockQuantity: 50,
        price: 49.99
      }
    });
  });

  describe('GET /api/inventory/:productId', () => {
    it('should return product inventory', async () => {
      const res = await request(app).get('/api/inventory/PROD-001');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('product');
      expect(res.body.product).toHaveProperty('productId', 'PROD-001');
      expect(res.body.product).toHaveProperty('stockQuantity');
    });

    it('should return 404 for non-existent product', async () => {
      const res = await request(app).get('/api/inventory/NONEXISTENT');
      
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/inventory/update', () => {
    it('should update inventory', async () => {
      const updateData = {
        productId: 'PROD-001',
        quantity: -1,
        orderId: 'TEST-ORDER-123',
        idempotencyKey: `TEST-UPDATE-KEY-${Date.now()}`
      };

      const res = await request(app)
        .post('/api/inventory/update')
        .send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('product');
      expect(res.body).toHaveProperty('update');
    });

    it('should handle idempotent updates', async () => {
      const key = `TEST-IDEMPOTENT-UPDATE-${Date.now()}`;
      const updateData = {
        productId: 'PROD-002',
        quantity: -2,
        orderId: 'TEST-ORDER-789',
        idempotencyKey: key
      };

      // First update
      const res1 = await request(app)
        .post('/api/inventory/update')
        .send(updateData);

      expect(res1.statusCode).toBe(200);
      const stock1 = res1.body.product.currentStock;

      // Second update with same key
      const res2 = await request(app)
        .post('/api/inventory/update')
        .send(updateData);

      expect(res2.statusCode).toBe(200);
      expect(res2.body.message).toContain('already updated');
      const stock2 = res2.body.update.newQuantity;

      // Stock should be the same (no duplicate deduction)
      expect(stock2).toBe(stock1);
    });
  });

  describe('Gremlin Stats', () => {
    it('should return gremlin configuration', async () => {
      const res = await request(app).get('/api/gremlin/stats');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('enabled');
      expect(res.body).toHaveProperty('latencyMs');
      expect(res.body).toHaveProperty('pattern');
    });

    it('should return crash simulator stats', async () => {
      const res = await request(app).get('/api/gremlin/crash-stats');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('enabled');
      expect(res.body).toHaveProperty('crashMode');
    });
  });
});
