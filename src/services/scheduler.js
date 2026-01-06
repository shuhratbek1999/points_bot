const cron = require("node-cron");
const smartup = require("./smartupService");
const logger = require("../utils/logger");

// 🔒 Parallel ishni oldini olish uchun flag
let isRunning = false;

async function safeSync() {
  if (isRunning) {
    logger.warn("⛔ SmartUp sync allaqachon ishlayapti, kuting...");
    return;
  }

  isRunning = true;
  try {
    logger.info("⏳ SmartUp sync boshlanmoqda...");
    await smartup.processNewEvents();
    logger.info("✅ SmartUp sync tugadi");
  } catch (err) {
    logger.error("SmartUp sync ERROR: " + err.message);
  } finally {
    isRunning = false;
  }
}

module.exports.startSmartupCron = () => {
  // Har 10 minutda
  cron.schedule("*/10 * * * *", async () => {
    await safeSync();
  });

  logger.info("✅ SmartUp cron scheduler ishga tushdi (har 10 minutda)");
};
