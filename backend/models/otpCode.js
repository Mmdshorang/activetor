module.exports = (sequelize, DataTypes) => {
  const OtpCode = sequelize.define(
    "OtpCode",
    {
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      entityType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      entityId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      codeHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      isUsed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "OtpCodes",
      indexes: [
        { fields: ["phone"] },
        { fields: ["entityType", "entityId"] },
        { fields: ["expiresAt"] },
      ],
    },
  );

  return OtpCode;
};
