module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define(
    "Message",
    {
      sender: DataTypes.STRING,
      senderType: {
        type: DataTypes.ENUM("customer", "user"),
        allowNull: false,
        defaultValue: "user",
      },
      text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      isReadByCustomer: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isReadByUser: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "Messages",
      timestamps: true,
    },
  );

  Message.associate = (models) => {
    Message.belongsTo(models.Customer, {
      foreignKey: "customerId",
      as: "customer",
    });

    Message.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return Message;
};
