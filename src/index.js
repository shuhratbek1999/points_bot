require("dotenv").config();
const bot = require("./bot");
const { sequelize } = require("./db");
const logger = require("./utils/logger");

const start = async () => {
  try {
    await sequelize.authenticate();
    logger.info("Database connected");
    await bot.start();
    logger.info("Bot started");
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (err) {
    logger.error("Failed to start", err);
    process.exit(1);
  }
};

start();
