const fs = require("fs").promises;
const path = require("path");

module.exports.getNewProducts = async () => {
  const filePath = path.join(process.cwd(), "data", "new_products.json");
  const file = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(file);

  // So‘nggi 7 kun ichidagi mahsulotlarni chiqaramiz
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  return data.filter((p) => new Date(p.created_at) >= weekAgo);
};
