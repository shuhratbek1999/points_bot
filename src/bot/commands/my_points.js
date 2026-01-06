const { User, Purchase, Product, Category } = require("../../db");
const { google } = require("googleapis");
const logger = require("../../utils/logger");
const fs = require("fs");
const path = require("path");

async function getUserScoreFromSheet(smartupId) {
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
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];

      const rowSmartupId = r[1];
      const score = r[3];

      if (String(rowSmartupId) === String(smartupId)) {
        return Number(score || 0);
      }
    }

    return 0;
  } catch (err) {
    console.error("Sheet read error:", err.message);
    return 0;
  }
}

module.exports = async (ctx) => {
  const tgId = String(ctx.from.id);
  const LAST_SYNC_FILE = path.resolve(process.cwd(), ".smartup_last_sync.json");
  const user = await User.findOne({ where: { telegram_id: tgId } });
  if (!user) {
    return ctx.reply("Siz ro'yxatdan o'tmagansiz. /start ni bosing.");
  }

  // 🟦 Jami ballni Google Sheetdan olish
  const totalPoints = await getUserScoreFromSheet(user.smartup_id);

  // 🟩 So‘nggi 10 ta activity
  const purchases = await Purchase.findAll({
    where: { user_id: user.id },
    include: [
      {
        model: Product,
        include: [{ model: Category, as: "category" }],
      },
    ],
    order: [["date", "DESC"]],
    limit: 10,
  });

  let text = `📊 <b>Ballarim</b>\n\n`;
  text += `Sizning joriy ballaringiz: <b>${totalPoints}</b>\n\n`;
  text += `🧾 <b>So'nggi faoliyat:</b>\n`;

  if (purchases.length === 0) text += "Faoliyat topilmadi.\n";
  function readLastSync() {
    try {
      if (!fs.existsSync(LAST_SYNC_FILE)) return null;
      const raw = fs.readFileSync(LAST_SYNC_FILE, "utf8");
      const obj = JSON.parse(raw);
      return obj.lastSync || null;
    } catch (e) {
      logger.warn("Could not read last sync file: " + e.message);
      return null;
    }
  }
  const lastSync = readLastSync();
  for (const p of purchases) {
    // console.log(readLastSync());
    const sign = p.type === "purchase" ? "+" : "-";
    const date = p.date.toLocaleDateString("uz-UZ").replace(/\//g, ".");
    const product = p.Product;

    const productName = product ? product.name : "Mahsulot";
    const category = product?.category;

    const percent = category ? category.percent : 0;
    const categoryName = category ? category.name : "—";

    text += `${sign}${p.points} ball — ${date} — ${productName} (Kategoriya ${categoryName}, ${percent}%)\n`;
  }

  text += `\n⏱ Oxirgi yangilanish: <i>${lastSync}</i>`;

  return ctx.reply(text, { parse_mode: "HTML" });
};
