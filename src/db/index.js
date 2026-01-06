const { Sequelize } = require("sequelize");
const logger = require("../utils/logger");

const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE,
  process.env.MYSQL_USER,
  process.env.MYSQL_PASSWORD,
  {
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT || 3306,
    dialect: "mysql",
    logging: (msg) => logger.info(msg),
  }
);

const User = require("./models/User")(sequelize);
const Category = require("./models/Category")(sequelize);
const Product = require("./models/Product")(sequelize);
const Purchase = require("./models/Purchase")(sequelize);

Category.hasMany(Product, { foreignKey: "category_id" });
Product.belongsTo(Category, { foreignKey: "category_id", as: "category" });

User.hasMany(Purchase, { foreignKey: "user_id" });
Purchase.belongsTo(User, { foreignKey: "user_id" });

Product.hasMany(Purchase, { foreignKey: "product_id" });
Purchase.belongsTo(Product, { foreignKey: "product_id" });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Category,
  Product,
  Purchase,
};
