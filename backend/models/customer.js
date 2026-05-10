module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define(
    "Customer",
    {
      fullName: DataTypes.STRING,
      phone: DataTypes.STRING,
      company: DataTypes.STRING,
      address: DataTypes.STRING,
      supportStatus: DataTypes.STRING,
      expireDate: DataTypes.DATE,
      username: {
        type: DataTypes.STRING,
        unique: true,
      },
      password: DataTypes.STRING,
      licenseLimit: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      contractStartDate: DataTypes.DATE,
      contractEndDate: DataTypes.DATE,
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: "Customers",
    },
  );

  Customer.associate = (models) => {
    Customer.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });

    Customer.hasMany(models.License, {
      foreignKey: "customerId",
      as: "licenses",
    });

    Customer.hasMany(models.Contract, {
      foreignKey: "customerId",
      as: "contracts",
    });
  };

  return Customer;
};
