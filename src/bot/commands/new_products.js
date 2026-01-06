const { Product, Category } = require("../../db");

module.exports = async (ctx) => {
  try {
    const products = await Product.findAll({
      include: [{ model: Category, as: "category" }],
      order: [["created_at", "DESC"]],
      limit: 10,
    });

    if (!products.length) {
      await ctx.reply("Mahsulotlar hali mavjud emas.");
      return;
    }

    let text = `🆕 <b>So‘nggi 10 ta mahsulot</b>\n\n`;

    for (const p of products) {
      const category = p.category
        ? `${p.category.name} (${p.category.percent}%)`
        : "—";

      text += `📦 <b>${p.name}</b>\n`;
      text += `💰 Narxi: ${p.price.toLocaleString("uz-UZ")} so‘m\n`;
      text += `🗂 Kategoriya: ${category}\n`;
      text += `📅 Qo‘shilgan: ${p.createdAt.toISOString().slice(0, 10)}\n\n`;
    }

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    console.error("❌ /products error:", err);
    await ctx.reply("Xatolik yuz berdi. Keyinroq yana urinib ko‘ring.");
  }
};
