const { User } = require("../../db");
const { Keyboard } = require("grammy");
const logger = require("../../utils/logger");

const start = async (ctx) => {
  const tgId = String(ctx.from.id);
  const adminId = String(process.env.ADMIN_TELEGRAM_ID || "");

  // ===========================
  //  👑 ADMIN FOYDALANUVCHI
  // ===========================
  if (tgId === adminId) {
    const adminKeyboard = new Keyboard()
      .text("📊 Ballarim")
      .text("🆕 Yangi mahsulotlar")
      .row()
      .text("ℹ️ Profilim")
      .row()
      .text("/sync_smartup")
      .text("/sync_sheet")
      .row()
      .text("/sheet_status")
      .text("/top_users")
      .resized();

    await ctx.reply(
      "<b>👋 Salom, admin!\nQuyidagi menyudan foydalaning 👇</b>",
      { parse_mode: "HTML", reply_markup: adminKeyboard }
    );
    return;
  }

  // ===========================
  //  👤 ODDIY USER (oldingi kabi)
  // ===========================
  const existing = await User.findOne({ where: { telegram_id: tgId } });

  if (existing) {
    const keyboard = new Keyboard()
      .text("📊 Ballarim")
      .text("🆕 Yangi mahsulotlar")
      .row()
      .text("ℹ️ Profilim")
      .resized();

    await ctx.reply("Siz tizimdasiz. Quyidagi menyudan tanlang 👇", {
      reply_markup: keyboard,
    });
    return;
  }

  // ===========================
  //  🆕 YANGI USER
  // ===========================
  const kb = new Keyboard().resized().requestContact("📱 Share contact");
  await ctx.reply("Ro'yxatdan o‘tish uchun telefon raqamingizni ulashing.", {
    reply_markup: kb,
  });
  ctx.session.awaitingSmartUpId = false;
};

// ===========================
//  📱 TELEFON QABUL QILISH
// ===========================
start.handleContact = async (ctx) => {
  try {
    const contact = ctx.message.contact;
    const tgId = String(ctx.from.id);

    const [user] = await User.findOrCreate({
      where: { telegram_id: tgId },
      defaults: {
        phone_number: contact.phone_number,
        points: 0,
      },
    });

    await ctx.reply("Rahmat! Endi SmartUp ID ni kiriting (misol: 12345).");
    ctx.session.awaitingSmartUpId = true;
  } catch (err) {
    logger.error("handleContact error: " + err.message);
    await ctx.reply("Xatolik yuz berdi.");
  }
};

// ===========================
//  🆔 SMARTUP ID QABUL QILISH
// ===========================
start.handleSmartUpId = async (ctx, smartupId) => {
  try {
    const tgId = String(ctx.from.id);
    const user = await User.findOne({ where: { telegram_id: tgId } });

    if (!user) {
      await ctx.reply("Avval telefonni ulashing (Share contact).");
      return;
    }

    user.smartup_id = smartupId;
    await user.save();
    ctx.session.awaitingSmartUpId = false;

    const keyboard = new Keyboard()
      .text("📊 Ballarim")
      .text("🆕 Yangi mahsulotlar")
      .row()
      .text("ℹ️ Profilim")
      .resized();

    await ctx.reply(
      "Ro'yxatdan o'tish tugadi. Quyidagi menyudan foydalaning 👇",
      {
        reply_markup: keyboard,
      }
    );
  } catch (err) {
    logger.error("handleSmartUpId error: " + err.message);
    await ctx.reply("SmartUp ID saqlanmadi, qayta urinib ko‘ring.");
  }
};

module.exports = start;
