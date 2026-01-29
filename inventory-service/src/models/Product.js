const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  productId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    field: 'product_id'
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'product_name'
  },
  stockQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'stock_quantity',
    validate: {
      min: 0
    }
  }
}, {
  tableName: 'products',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['product_id']
    }
  ]
});

module.exports = Product;
