const { DataTypes } = require("sequelize");
module.exports = (sequelize) => {
  return sequelize.define(
    "Product",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING },
      price: { type: DataTypes.DECIMAL(12, 2) },
      smartup_product_id: {
        type: DataTypes.STRING,
        unique: true, // dublikat bo‘lmasin
      },
      product_code: { type: DataTypes.STRING },
      category_id: { type: DataTypes.INTEGER },
    },
    { tableName: "products", underscored: true, timestamps: true }
  );
};
