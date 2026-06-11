module.exports = (sequelize, DataTypes) => {
  const Log = sequelize.define(
    "Log",
    {
      level: {
        type: DataTypes.STRING, // INFO | ERROR | WARN
        allowNull: false,
      },

      action: {
        type: DataTypes.STRING, // مثلا CREATE_LICENSE
        allowNull: false,
      },

      message: {
        type: DataTypes.TEXT,
      },

      error: {
        type: DataTypes.TEXT,
      },

      stack: {
        type: DataTypes.TEXT,
      },

      requestBody: {
        type: DataTypes.JSONB, // مهم برای PostgreSQL
      },

      ip: {
        type: DataTypes.STRING,
      },

      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "Logs",
      paranoid: true, // soft delete مثل خودت
    }
  );

  Log.associate = (models) => {
    Log.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return Log;
};