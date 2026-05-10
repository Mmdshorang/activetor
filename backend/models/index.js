const Sequelize = require("sequelize");
const sequelize = require("../config/db");
const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// مدل‌های موجود
db.User = require("./user")(sequelize, Sequelize);
db.Customer = require("./customer")(sequelize, Sequelize);
db.Version = require("./version")(sequelize, Sequelize);
db.Message = require("./message")(sequelize, Sequelize);

db.License = require("./License")(sequelize, Sequelize);
db.Contract = require("./contract")(sequelize, Sequelize);
db.RenewalRequest = require("./renewalRequest")(sequelize, Sequelize);

Object.keys(db).forEach((modelName) => {
  if (db[modelName] && typeof db[modelName].associate === "function") {
    db[modelName].associate(db);
  }
});

module.exports = db;
