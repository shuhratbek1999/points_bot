const { User, Purchase, Product } = require("../../db");
const { getUserScoreFromSheet } = require("./sheet");

module.exports = async (ctx) => {
  const tgId = String(ctx.from.id);
  const user = await User.findOne({ where: { telegram_id: tgId } });

  if (!user) {
    await ctx.reply("Ro'yxatdan o‘tmagansiz. /start ni bosing.");
    return;
  }

  // 🔹 Oxirgi xarid + product JOIN
  const lastPurchase = await Purchase.findOne({
    where: { user_id: user.id, type: "purchase" },
    include: [{ model: Product }],
    order: [["date", "DESC"]],
  });
  // console.log(lastPurchase);

  let lastPurchaseName = "—";
  let lastPurchaseDate = "—";

  if (lastPurchase) {
    lastPurchaseName = lastPurchase.Product?.name || "—";
    lastPurchaseDate = lastPurchase.date
      .toLocaleDateString("uz-UZ")
      .replace(/\//g, ".");
  }

  // 🔥 Google Sheet dan ball olish
  const sheetScore = await getUserScoreFromSheet(user.smartup_id);

  const text = `ℹ️ Profilim
━━━━━━━━━━━━━━━
👤 Ism: ${ctx.from.first_name || ""} ${ctx.from.last_name || ""}
🆔 ID: ${user.telegram_id}
📞 Telefon: ${user.phone_number || "—"}
🧾 Oxirgi xarid: ${lastPurchaseName}
📅 Sana: ${lastPurchaseDate}
💰 Ballar: ${sheetScore ?? user.points ?? 0}`;

  await ctx.reply(text);
};
