require("dotenv").config();
const bot = require("./bot");
const { sequelize } = require("./db");
const logger = require("./utils/logger");

const { startSmartupCron } = require("./services/scheduler");
const smartup = require("./services/smartupService");

const start = async () => {
  try {
    // 1️⃣ DB
    await sequelize.authenticate();
    logger.info("Database connected");

    // 2️⃣ Bot
    await bot.start();
    logger.info("Bot started");

    // 3️⃣ SmartUp init + cron
    smartup.init(bot);
    startSmartupCron();
    logger.info("SmartUp cron started");

    // 4️⃣ Signal handlers
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (err) {
    logger.error("Failed to start", err);
    process.exit(1);
  }
};

start();
