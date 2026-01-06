const { google } = require("googleapis");
const { Product, Category } = require("../db");
require("dotenv").config();

async function getAuth() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return await auth.getClient();
}

async function readSheet(range = "A2:D3000") {
  const auth = await getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range,
  });
  return res.data.values || [];
}

async function seedCategories() {
  const categoriesData = [
    { name: "C1", percent: 1.0 },
    { name: "C2", percent: 1.5 },
    { name: "C3", percent: 2.0 },
    { name: "C4", percent: 2.5 },
    { name: "C5", percent: 3.0 },
  ];

  for (const cat of categoriesData) {
    await Category.findOrCreate({
      where: { percent: cat.percent },
      defaults: cat,
    });
  }
  console.log("✅ Kategoriyalar yaratildi yoki mavjud");
}

module.exports.syncSheet = async () => {
  try {
    await seedCategories();

    const rows = await readSheet("A2:D3000");
    const categories = await Category.findAll();

    // percent -> category_id map
    const categoryMap = {};
    for (const cat of categories) {
      categoryMap[parseFloat(cat.percent).toFixed(1)] = cat.id;
    }

    let updated = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const [smartupProductId, name, priceStr, percentStr] = row;
        if (!smartupProductId || !name) continue;

        const price = parseFloat(priceStr) || 0;
        const percent = parseFloat(percentStr);

        if (isNaN(percent)) {
          console.log(`⚠️ Foiz topilmadi: ${name}`);
          continue;
        }

        const categoryId = categoryMap[percent.toFixed(1)];
        if (!categoryId) {
          console.log(`⚠️ Kategoriya topilmadi: ${percent} (${name})`);
          continue;
        }

        await Product.upsert({
          smartup_product_id: smartupProductId, // <-- MUHIM TUZATISH
          name,
          price,
          category_id: categoryId,
        });

        updated++;
      } catch (e) {
        console.log("❌ Xato (product row):", e.message);
        errors++;
      }
    }

    console.log(`✅ Sheet Sync: ${updated} yangilandi, ${errors} xato`);
    return { updated, errors };
  } catch (err) {
    console.error("❌ Sheet Sync xatolik:", err.message);
    return { updated: 0, errors: 1 };
  }
};
