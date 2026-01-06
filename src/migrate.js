require('dotenv').config();
const { sequelize } = require('./db');
const logger = require('./utils/logger');

const migrate = async () => {
  try {
    await sequelize.authenticate();
    logger.info('DB connected, running sync...');
    await sequelize.sync({ alter: true });
    logger.info('Migrations complete (sequelize.sync)');
    process.exit(0);
  } catch (err) {
    logger.error('Migration error: ' + err.message);
    process.exit(1);
  }
};

migrate();
