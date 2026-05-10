module.exports = (sequelize, DataTypes) => {
  const Contract = sequelize.define(
    "Contract",
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      startDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("active", "expired", "cancelled"),
        defaultValue: "active",
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: "Contracts",
      timestamps: true,
    },
  );

  Contract.associate = (models) => {
    Contract.belongsTo(models.Customer, {
      foreignKey: "customerId",
      as: "customer",
    });

    Contract.belongsTo(models.User, {
      foreignKey: "userId",
      as: "creator",
    });
  };

  return Contract;
};
