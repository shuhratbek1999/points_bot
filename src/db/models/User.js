const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  return sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    telegram_id: { type: DataTypes.STRING, unique: true },
    phone_number: { type: DataTypes.STRING },
    smartup_id: { type: DataTypes.STRING },
    points: { type: DataTypes.INTEGER, defaultValue: 0 },
    last_purchase_date: { type: DataTypes.DATE, allowNull: true }
  }, { tableName: 'users', underscored: true, timestamps: true });
};
