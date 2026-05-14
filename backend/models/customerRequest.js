module.exports = (sequelize, DataTypes) => {
  const CustomerRequest = sequelize.define(
    "CustomerRequest",
    {
      fullName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      company: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      requesterUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      handledByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "CustomerRequests",
      timestamps: true,
    },
  );

  CustomerRequest.associate = (models) => {
    CustomerRequest.belongsTo(models.User, {
      foreignKey: "requesterUserId",
      as: "requesterUser",
    });

    CustomerRequest.belongsTo(models.User, {
      foreignKey: "handledByUserId",
      as: "handlerUser",
    });
  };

  return CustomerRequest;
};

