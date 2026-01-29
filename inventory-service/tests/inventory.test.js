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
        idempotencyKey: 'TEST-UPDATE-KEY-456'
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
      const updateData = {
        productId: 'PROD-002',
        quantity: -2,
        orderId: 'TEST-ORDER-789',
        idempotencyKey: 'TEST-IDEMPOTENT-UPDATE-789'
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
      expect(res2.body.message).toContain('already processed');
      const stock2 = res2.body.product.stockQuantity;

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
