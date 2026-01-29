const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'order_db',
  process.env.DB_USER || 'order_user',
  process.env.DB_PASSWORD || 'order_password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);


const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Order Service: PostgreSQL connection established successfully');


    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Order Service: Database models synchronized');

    return true;
  } catch (error) {
    console.error('Order Service: Unable to connect to database:', error);
    return false;
  }
};

module.exports = { sequelize, connectDB };
