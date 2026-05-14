module.exports = (sequelize, DataTypes) => {
  const SmsLog = sequelize.define(
    "SmsLog",
    {
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      contractId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("success", "failed"),
        allowNull: false,
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "kavenegar",
      },
      providerResponse: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "SmsLogs",
      timestamps: true,
      indexes: [
        // prevent duplicate reminders per contract/type
        { unique: true, fields: ["type", "contractId"] },
        { fields: ["phone"] },
        { fields: ["sentAt"] },
      ],
    },
  );

  return SmsLog;
};
