// models/License.js
module.exports = (sequelize, DataTypes) => {
  const License = sequelize.define('License', {
    systemName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    version: {
      type: DataTypes.STRING,
      allowNull: false
    },
    code1: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    code2: DataTypes.STRING,
    code3: DataTypes.STRING,
    expireDate: DataTypes.DATE,
    licenseId: DataTypes.STRING, // 👈 اضافه کردن فیلد licenseId
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // 👈 کلید خارجی به جدول Customer (نه User)
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'licenses',
    timestamps: true
  });

  // رابطه: هر لایسنس مال یه مشتریه
  License.associate = (models) => {
    License.belongsTo(models.Customer, {
      foreignKey: "customerId",
      as: "customer"
    });
  };

  return License;
};