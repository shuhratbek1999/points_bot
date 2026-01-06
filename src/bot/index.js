const { Bot, session } = require("grammy");
const startCommand = require("./commands/start");
const myPointsCommand = require("./commands/my_points");
const newProducts = require("./commands/new_products");
const profileCommand = require("./commands/profile");
const adminCommand = require("./commands/admin");
const scheduler = require("./scheduler");
const logger = require("../utils/logger");
const smartupService = require("../services/smartupService");

const bot = new Bot(process.env.BOT_TOKEN);
smartupService.init(bot);
bot.use(session({ initial: () => ({ awaitingSmartUpId: false }) }));

// ---- KOMANDALAR ----
bot.command("start", startCommand);
bot.command("my_points", myPointsCommand);
bot.command("profile", profileCommand);
bot.command("new_products", newProducts);
bot.command("sync_smartup", adminCommand.syncSmartUp);
bot.command("sync_sheet", adminCommand.syncSheet);
bot.command("sheet_status", adminCommand.sheetStatus);
bot.command("top_users", adminCommand.topUsers);

// ---- MESSAGE HANDLER ----
bot.on("message", async (ctx) => {
  try {
    const msg = ctx.message;

    // 1️⃣ Telefon raqam yuborilganda
    if (msg.contact) {
      await startCommand.handleContact(ctx);
      return;
    }

    // 2️⃣ SmartUp ID kiritayotgan bo‘lsa
    const s = ctx.session;
    if (s && s.awaitingSmartUpId && msg.text) {
      await startCommand.handleSmartUpId(ctx, msg.text.trim());
      return;
    }

    // 3️⃣ Tugmalar orqali kelgan textlarni aniqlash
    if (msg.text) {
      const text = msg.text.trim();

      if (text === "📊 Ballarim") {
        await myPointsCommand(ctx);
        return;
      }

      if (text === "🆕 Yangi mahsulotlar") {
        await newProducts(ctx);
        return;
      }

      if (text === "ℹ️ Profilim") {
        await profileCommand(ctx);
        return;
      }
    }
  } catch (err) {
    logger.error("Message handler error: " + err.message);
  }
});

// ---- CRON JOB ----
scheduler.init(bot);

module.exports = bot;
