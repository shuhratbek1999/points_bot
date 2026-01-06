const cron = require("node-cron");
const smartupService = require("../services/smartupService");
const notifyService = require("../services/notifyService");
const logger = require("../utils/logger");

module.exports.init = (bot) => {
  // cron.schedule('*/15 * * * *', async () => {
  //   try {
  //     const res = await smartupService.processNewEvents(bot);
  //     logger.info('Cron SmartUp processed: ' + JSON.stringify(res));
  //   } catch (err) {
  //     logger.error('Cron SmartUp error: ' + err.message);
  //   }
  // });

  cron.schedule("0 9 */2 * *", async () => {
    try {
      await notifyService.sendBiDailySummaries(bot);
    } catch (err) {
      logger.error("Cron notify error: " + err.message);
    }
  });
};
