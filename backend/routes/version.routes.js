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
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. پیدا کردن رکورد
    const version = await db.Version.findByPk(id);

    if (!version) {
      return res.status(404).json({ message: "نسخه مورد نظر یافت نشد." });
    }

    // 2. آپدیت کردن رکورد
    await version.update(req.body);

    // 3. برگرداندن داده‌های جدید
    res.json(version);
  } catch (error) {
    res.status(500).json({ message: "خطا در ویرایش نسخه", error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  await db.Version.destroy({ where: { id: req.params.id } });
  res.send("deleted");
});

module.exports = router;


