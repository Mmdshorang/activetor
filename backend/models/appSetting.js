module.exports = (sequelize, DataTypes) => {
  const AppSetting = sequelize.define(
    "AppSetting",
    {
      key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      value: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: "AppSettings",
      timestamps: true,
    },
  );

  return AppSetting;
};
