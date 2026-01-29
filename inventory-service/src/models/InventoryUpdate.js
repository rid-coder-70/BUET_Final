const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InventoryUpdate = sequelize.define('InventoryUpdate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  productId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'product_id'
  },
  quantityChange: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'quantity_change'
  },
  previousQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'previous_quantity'
  },
  newQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'new_quantity'
  },
  orderId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'order_id'
  },
  idempotencyKey: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
    field: 'idempotency_key'
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'inventory_updates',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['product_id']
    },
    {
      fields: ['order_id']
    },
    {
      unique: true,
      fields: ['idempotency_key']
    }
  ]
});

module.exports = InventoryUpdate;
