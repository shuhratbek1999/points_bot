const { DataTypes } = require("sequelize");
module.exports = (sequelize) => {
  return sequelize.define(
    "Category",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, unique: true },
      percent: { type: DataTypes.DECIMAL(5, 2) },
    },
    { tableName: "categories", underscored: true, timestamps: true }
  );
};
