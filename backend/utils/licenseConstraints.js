const CODE_COLUMNS = new Set(["code1", "code2", "code3"]);
const LICENSES_TABLE = "licenses";

const normalizeColumns = (columns) => {
  if (Array.isArray(columns)) return columns;
  if (typeof columns === "string") {
    return columns.replace(/[{}"]/g, "").split(",").filter(Boolean);
  }
  return [];
};

const getSingleCodeUniqueConstraints = async (sequelize) => {
  const [rows] = await sequelize.query(`
    SELECT
      c.conname AS name,
      array_agg(a.attname ORDER BY key_position.ordinality) AS columns
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS key_position(attnum, ordinality)
      ON true
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
      AND a.attnum = key_position.attnum
    WHERE c.conrelid = to_regclass('public.${LICENSES_TABLE}')
      AND c.contype = 'u'
    GROUP BY c.conname
  `);

  return rows.filter((row) => {
    const columns = normalizeColumns(row.columns);
    return columns.length === 1 && CODE_COLUMNS.has(columns[0]);
  });
};

const removeSingleCodeUniqueConstraints = async (sequelize) => {
  const queryInterface = sequelize.getQueryInterface();
  const constraints = await getSingleCodeUniqueConstraints(sequelize);

  for (const constraint of constraints) {
    await queryInterface.removeConstraint(LICENSES_TABLE, constraint.name);
    console.log(`Removed invalid license unique constraint: ${constraint.name}`);
  }
};

module.exports = {
  removeSingleCodeUniqueConstraints,
};
