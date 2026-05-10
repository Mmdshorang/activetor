module.exports = (sequelize, DataTypes) => {
  const RenewalRequest = sequelize.define(
    "RenewalRequest",
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      requesterRole: {
        type: DataTypes.ENUM("customer", "agent", "user", "admin"),
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
      requesterUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      handledByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "RenewalRequests",
      timestamps: true,
    },
  );

  RenewalRequest.associate = (models) => {
    RenewalRequest.belongsTo(models.Contract, {
      foreignKey: "contractId",
      as: "contract",
    });

    RenewalRequest.belongsTo(models.Customer, {
      foreignKey: "customerId",
      as: "customer",
    });

    RenewalRequest.belongsTo(models.User, {
      foreignKey: "requesterUserId",
      as: "requesterUser",
    });

    RenewalRequest.belongsTo(models.User, {
      foreignKey: "handledByUserId",
      as: "handlerUser",
    });
  };

  return RenewalRequest;
};
