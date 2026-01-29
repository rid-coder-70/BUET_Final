const request = require('supertest');
const app = require('../src/index');

describe('Order Service API', () => {
  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'healthy');
    });
  });

  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      const orderData = {
        customerId: 'CUST-TEST',
        productId: 'PROD-001',
        productName: 'Test Product',
        quantity: 1
      };

      const res = await request(app)
        .post('/api/orders')
        .send(orderData);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('order');
      expect(res.body.order).toHaveProperty('id');
      expect(res.body.order.customerId).toBe('CUST-TEST');
    });

    it('should reject order with missing fields', async () => {
      const invalidOrder = {
        customerId: 'CUST-TEST'
      };

      const res = await request(app)
        .post('/api/orders')
        .send(invalidOrder);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should handle idempotency', async () => {
      const orderData = {
        customerId: 'CUST-IDEMPOTENT',
        productId: 'PROD-001',
        productName: 'Test Product',
        quantity: 1,
        idempotencyKey: `TEST-IDEMPOTENT-KEY-${Date.now()}`
      };

      const res1 = await request(app)
        .post('/api/orders')
        .send(orderData);

      expect(res1.statusCode).toBe(201);
      const orderId1 = res1.body.order.id;

      const res2 = await request(app)
        .post('/api/orders')
        .send(orderData);

      expect(res2.statusCode).toBe(200);
      expect(res2.body.order.id).toBe(orderId1);
      expect(res2.body.message).toContain('already exists');
    });
  });

  describe('GET /api/resilience/stats', () => {
    it('should return circuit breaker stats', async () => {
      const res = await request(app).get('/api/resilience/stats');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('state');
      expect(res.body).toHaveProperty('stats');
      expect(res.body).toHaveProperty('config');
    });
  });
});
