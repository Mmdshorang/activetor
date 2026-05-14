const getSetting = async (db, key, defaultValue) => {
  const existing = await db.AppSetting.findOne({ where: { key } });
  if (!existing) return defaultValue;
  const json = existing.toJSON ? existing.toJSON() : existing;
  return json.value;
};

const setSetting = async (db, key, value) => {
  const existing = await db.AppSetting.findOne({ where: { key } });
  if (existing) {
    await existing.update({ value });
    return existing;
  }
  return db.AppSetting.create({ key, value });
};

module.exports = {
  getSetting,
  setSetting,
};
