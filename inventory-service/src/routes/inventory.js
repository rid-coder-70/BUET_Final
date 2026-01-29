const express = require('express');
const Product = require('../models/Product');
const InventoryUpdate = require('../models/InventoryUpdate');
const { sequelize } = require('../config/database');

const router = express.Router();

router.get('/:productId', async (req, res) => {
  try {
    const product = await Product.findOne({
      where: { productId: req.params.productId }
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        productId: req.params.productId
      });
    }

    res.json({ product });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({
      error: 'Failed to fetch inventory',
      details: error.message
    });
  }
});

router.post('/update', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { productId, quantity, orderId, idempotencyKey } = req.body;

    
    if (!productId || !quantity) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['productId', 'quantity']
      });
    }

    if (idempotencyKey) {
      const existingUpdate = await InventoryUpdate.findOne({
        where: { idempotencyKey },
        transaction
      });
      
      if (existingUpdate) {
        await transaction.rollback();
        return res.status(200).json({
          message: 'Inventory already updated (idempotent)',
          update: existingUpdate,
          idempotent: true
        });
      }
    }


    let product = await Product.findOne({
      where: { productId },
      transaction
    });

    if (!product) {
      await transaction.rollback();
      return res.status(404).json({
        error: 'Product not found',
        productId
      });
    }

    if (product.stockQuantity < quantity) {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Insufficient stock',
        available: product.stockQuantity,
        requested: quantity
      });
    }

    const previousQuantity = product.stockQuantity;
    const newQuantity = previousQuantity - quantity;

    await product.update({ stockQuantity: newQuantity }, { transaction });

    const inventoryUpdate = await InventoryUpdate.create({
      productId,
      quantityChange: -quantity,
      previousQuantity,
      newQuantity,
      orderId: orderId || null,
      idempotencyKey: idempotencyKey || null,
      reason: 'order_shipped'
    }, { transaction });

    await transaction.commit();

    res.status(200).json({
      message: 'Inventory updated successfully',
      product: {
        productId: product.productId,
        productName: product.productName,
        previousStock: previousQuantity,
        currentStock: newQuantity
      },
      update: inventoryUpdate
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating inventory:', error);
    res.status(500).json({
      error: 'Failed to update inventory',
      details: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const products = await Product.findAll({
      order: [['productName', 'ASC']]
    });

    res.json({ count: products.length, products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      error: 'Failed to fetch products',
      details: error.message
    });
  }
});

module.exports = router;
