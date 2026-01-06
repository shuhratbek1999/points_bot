const { User, Purchase } = require('../db');
const dayjs = require('dayjs');
const logger = require('../utils/logger');

const sendBiDailySummaries = async (bot) => {
  const users = await User.findAll();
  for (const u of users) {
    try {
      const since = dayjs().subtract(2, 'day').toDate();
      const activities = await Purchase.findAll({ where: { user_id: u.id, date: { [require('sequelize').Op.gte]: since } } });
      let added = 0;
      activities.forEach(a => { if (a.type === 'purchase') added += a.points; else added -= a.points; });
      const text = `📬 Ball Yangilanishi:\nHafta davomida sizga ${added} ball qo'shildi.\nJoriy balans: ${u.points} ball.`;
      try { await bot.api.sendMessage(u.telegram_id, text); } catch (err) { logger.warn('Msg failed: ' + err.message); }
    } catch (err) {
      logger.error('sendBiDaily error: ' + err.message);
    }
  }
};

module.exports = { sendBiDailySummaries };
