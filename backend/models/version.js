module.exports = (sequelize, DataTypes) => {
  return sequelize.define("Version", {
    name: DataTypes.STRING
  });
};