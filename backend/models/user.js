// models/User.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    fullName: DataTypes.STRING,
    username: { type: DataTypes.STRING, unique: true },
    password: DataTypes.STRING,
    phone: DataTypes.STRING,
    role: DataTypes.STRING,
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    pagePermissions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  });

  // رابطه: هر ادمین چند مشتری داره
  User.associate = (models) => {
    User.hasMany(models.Customer, {
      foreignKey: "userId",
      as: "customers"
    });

    User.hasMany(models.Contract, {
      foreignKey: "userId",
      as: "contracts",
    });
  };

  return User;
};
