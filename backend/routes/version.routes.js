const router = require("express").Router();
const db = require("../models");
const { auth, allowRoles } = require("../middleware/authorize");

router.use(auth);
router.use(allowRoles("admin", "user"));

router.get("/", async (req, res) => {
  res.json(await db.Version.findAll());
});

router.post("/", async (req, res) => {
  res.json(await db.Version.create(req.body));
});

router.delete("/:id", async (req, res) => {
  await db.Version.destroy({ where: { id: req.params.id } });
  res.send("deleted");
});

module.exports = router;


