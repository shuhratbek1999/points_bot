const { Category } = require('../db');

const calculatePointsForProduct = async (product) => {
  let percent = 0;
  if (product.Category && product.Category.percent) percent = parseFloat(product.Category.percent);
  else {
    const cat = await Category.findByPk(product.category_id);
    percent = cat ? parseFloat(cat.percent) : 0;
  }
  const price = parseFloat(product.price);
  const points = Math.round(price * percent / 100);
  return points;
};

module.exports = { calculatePointsForProduct };
