const smartupService = require("../../services/smartupService");
const syncSheet = require("../../services/sheetsService");
const { Category, Product, User } = require("../../db");
const { google } = require("googleapis");

const isAdmin = (ctx) => {
  const adminId = String(process.env.ADMIN_TELEGRAM_ID || "");
  return String(ctx.from.id) === adminId;
};

let syncInProgress = false;
function roundScore(score) {
  // Agar kasr uzun bo'lsa, yaxlitlash
  if (typeof score === "string") {
    score = parseFloat(score);
  }
  return Math.round(score * 100) / 100;
}
// Google Sheet'dan ballarni olish funksiyasi
async function getTopUsersFromSheet() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.USTALARSHEET_ID,
      range: `ustalar!A:D`,
    });

    const rows = res.data.values || [];
    const users = [];

    // 1-qator sarlavha, shuning uchun 1-indekstdan boshlaymiz
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 4) {
        const id = row[0] || "Noma'lum";
        const smartupId = row[1] || "";
        const name = row[2] || "";
        let score = Number(row[3]) || 0;
        score = roundScore(score);
        users.push({
          id,
          smartupId,
          name,
          score,
        });
      }
    }

    // Bal bo'yicha kamayish tartibida saralash
    users.sort((a, b) => b.score - a.score);

    return users.slice(0, 10); // Faqat top 10 ta
  } catch (err) {
    console.error("Sheet read error (top_users):", err.message);
    throw err;
  }
}

module.exports.syncSmartUp = async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("Bu buyruq faqat adminlar uchun.");
    return;
  }

  if (syncInProgress) {
    await ctx.reply("⏳ Sinxronizatsiya allaqachon davom etmoqda, kuting...");
    return;
  }

  try {
    syncInProgress = true;

    // ✅ botni uzatamiz
    const res = await smartupService.processNewEvents(ctx.bot);
    // console.log(res);

    await ctx.reply(
      `✅ SmartUp Sync:\nYangilangan: ${res.processed} ta xarid, ${res.returns} ta vozvrat\n⏱ So'nggi sync: ${res.lastSync}`
    );
  } catch (err) {
    console.error("Sync error:", err);
    await ctx.reply("❌ SmartUp ma'lumotlarini sinxronlashda xato yuz berdi.");
  } finally {
    syncInProgress = false;
  }
};

module.exports.syncSheet = async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("Bu buyruq faqat adminlar uchun.");
    return;
  }
  const res = await syncSheet.syncSheet();
  await ctx.reply(
    `✅ Sheet Sync:\n${res.updated} ta kategoriya yangilandi. Xatolar: ${res.errors}`
  );
};

module.exports.sheetStatus = async (ctx) => {
  const cats = await Category.findAll();
  const prods = await Product.findAll();
  await ctx.reply(
    `📊 Sheet status:\nKategoriya soni: ${cats.length}\nMahsulotlar: ${prods.length}`
  );
};

module.exports.topUsers = async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("Bu buyruq faqat adminlar uchun.");
    return;
  }

  try {
    await ctx.reply("📊 Google Sheet'dan top ustalar yuklanmoqda...");

    // Google Sheet'dan top ustalarni olish
    const topUsers = await getTopUsersFromSheet();

    if (topUsers.length === 0) {
      await ctx.reply("❌ Hech qanday ustalar topilmadi yoki sheet bo'sh.");
      return;
    }

    // Formatlash
    let text = "🏆 **TOP USTALAR**\n\n";
    text += "📊 *Ballar bo'yicha reyting:*\n\n";

    topUsers.forEach((user, index) => {
      const medal =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "▫️";

      text += `${medal} *${index + 1}. ${user.id}*\n`;
      text += `   📱: ${user.name}\n`;
      text += `   🔢 ID: ${user.smartupId || "N/A"}\n`;
      text += `   ⭐ Ball: *${user.score}*\n\n`;
    });

    text += `\n⏱️ *Yangilangan:* ${new Date().toLocaleString("uz-UZ")}`;
    text += `\n📋 *Jami ko'rsatilgan:* ${topUsers.length} ta usta`;

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔄 Yangilash",
              callback_data: "refresh_top_users",
            },
          ],
        ],
      },
    });
  } catch (err) {
    console.error("Top users error:", err);
    await ctx.reply("❌ Google Sheet'dan ma'lumot olishda xato yuz berdi.");
  }
};

// Yangilash tugmasi uchun handler (agar kerak bo'lsa)
module.exports.refreshTopUsers = async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery("Bu faqat admin uchun!");
    return;
  }

  try {
    await ctx.answerCbQuery("Yangi ma'lumotlar yuklanmoqda...");

    const topUsers = await getTopUsersFromSheet();

    let text = "🏆 **TOP USTALAR (Google Sheet)**\n\n";
    text += "📊 *Ballar bo'yicha reyting:*\n\n";

    topUsers.forEach((user, index) => {
      const medal =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "▫️";
      const phoneFormatted = user.phone
        ? user.phone.replace("+", "")
        : "Noma'lum";

      text += `${medal} *${index + 1}. ${user.ism}*\n`;
      text += `   📱: ${phoneFormatted}\n`;
      text += `   🔢 ID: ${user.smartupId || "N/A"}\n`;
      text += `   ⭐ Ball: *${user.score}*\n\n`;
    });

    text += `\n⏱️ *Yangilangan:* ${new Date().toLocaleString("uz-UZ")}`;

    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔄 Yangilash",
              callback_data: "refresh_top_users",
            },
          ],
        ],
      },
    });
  } catch (err) {
    console.error("Refresh error:", err);
    await ctx.answerCbQuery("Xato yuz berdi!");
  }
};
