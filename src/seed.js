require("dotenv").config();
const { sequelize, Category, Product, User } = require("./db");
const logger = require("./utils/logger");

const seed = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    await Category.upsert({ name: "C1", percent: 1.0 });
    await User.create({
      telegram_id: "999999",
      phone_number: "+998901234567",
      smartup_id: "U100",
      points: 0,
    });
    logger.info("Seed complete");
    process.exit(0);
  } catch (err) {
    logger.error("Seed error: " + err.message);
    process.exit(1);
  }
};

seed();
