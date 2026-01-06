const cron = require("node-cron");
const smartup = require("./smartupService");
const logger = require("../utils/logger");

module.exports.startSmartupCron = () => {
  // Har 10 minutda
  cron.schedule("*/10 * * * *", async () => {
    logger.info("⏰ SmartUp cron ishga tushdi");

    try {
      await smartup.processNewEvents();
    } catch (err) {
      logger.error("SmartUp cron error: " + err.message);
    }
  });

  logger.info("✅ SmartUp cron scheduler ishga tushdi (har 10 minutda)");
};
