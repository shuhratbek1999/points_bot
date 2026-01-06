const { DataTypes } = require("sequelize");
module.exports = (sequelize) => {
  return sequelize.define(
    "Purchase",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER },
      product_id: { type: DataTypes.INTEGER },
      smartup_deal_id: { type: DataTypes.INTEGER },
      smartup_item_id: { type: DataTypes.STRING },
      smartup_product_id: { type: DataTypes.INTEGER },
      type: { type: DataTypes.ENUM("purchase", "return") },
      points: { type: DataTypes.DECIMAL(10, 2) },
      quantity: { type: DataTypes.DECIMAL(10, 2) },
      amount: { type: DataTypes.DECIMAL(12, 2) },
      date: { type: DataTypes.DATE },
      note: { type: DataTypes.STRING },
    },
    { tableName: "purchases", underscored: true, timestamps: true }
  );
};
