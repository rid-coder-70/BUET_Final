const express = require('express');
const Order = require('../models/Order');
const { updateInventory } = require('../services/inventoryClient');

const router = express.Router();


router.post('/', async (req, res) => {
  try {
    const { customerId, productId, productName, quantity, idempotencyKey } = req.body;

   
    if (!customerId || !productId || !productName || !quantity) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customerId', 'productId', 'productName', 'quantity']
      });
    }

    
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ where: { idempotencyKey } });
      if (existingOrder) {
        return res.status(200).json({
          message: 'Order already exists (idempotent)',
          order: existingOrder
        });
      }
    }

    
    const order = await Order.create({
      customerId,
      productId,
      productName,
      quantity,
      status: 'validated',
      idempotencyKey: idempotencyKey || null
    });

    console.log(`Order created: ${order.id}`);

    
    const inventoryResult = await updateInventory(
      productId,
      quantity,
      order.id,
      idempotencyKey ? `${idempotencyKey}-inventory` : null
    );

    if (inventoryResult.success) {
      
      await order.update({
        status: 'shipped',
        inventoryUpdated: true
      });

      console.log(`Order ${order.id} shipped and inventory updated`);

      return res.status(201).json({
        message: 'Order created and shipped successfully',
        order,
        inventoryUpdate: inventoryResult.data
      });
    } else {
      await order.update({
        status: 'failed',
        errorMessage: inventoryResult.error
      });

      console.warn(`Order ${order.id} created but inventory update failed: ${inventoryResult.error}`);
      return res.status(201).json({
        message: 'Order created but inventory update failed',
        order,
        inventoryError: inventoryResult.error,
        circuitBreakerOpen: inventoryResult.circuitBreakerOpen
      });
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      error: 'Failed to create order',
      details: error.message
    });
  }
});


router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      error: 'Failed to fetch order',
      details: error.message
    });
  }
});


router.get('/', async (req, res) => {
  try {
    const { customerId, status } = req.query;
    
    const whereClause = {};
    if (customerId) whereClause.customerId = customerId;
    if (status) whereClause.status = status;

    const orders = await Order.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    res.json({ count: orders.length, orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      error: 'Failed to fetch orders',
      details: error.message
    });
  }
});

module.exports = router;
