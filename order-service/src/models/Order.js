const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  customerId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'customer_id'
  },
  productId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'product_id'
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'product_name'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'validated', 'shipped', 'failed'),
    defaultValue: 'pending',
    allowNull: false
  },
  inventoryUpdated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'inventory_updated'
  },
  idempotencyKey: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
    field: 'idempotency_key'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message'
  }
}, {
  tableName: 'orders',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['customer_id']
    },
    {
      fields: ['status']
    },
    {
      unique: true,
      fields: ['idempotency_key']
    }
  ]
});

module.exports = Order;
