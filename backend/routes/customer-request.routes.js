const router = require("express").Router();
const db = require("../models");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { auth, allowRoles } = require("../middleware/authorize");
const { parseApiError } = require("../utils/apiError");
const { normalizeIranPhone } = require("../utils/phone");

router.use(auth);

const includes = [
  { model: db.User, as: "requesterUser", attributes: ["id", "fullName", "username", "role"] },
  { model: db.User, as: "handlerUser", attributes: ["id", "fullName", "username", "role"] },
];

const isAgent = (req) => req.user?.role === "agent";
const canApprove = (req) => req.user?.role === "admin" || req.user?.role === "user";

router.get("/", allowRoles("admin", "user", "agent"), async (req, res) => {
  try {
    const where = {};
    if (isAgent(req)) {
      where.requesterUserId = req.user.id;
    }
    if (req.query.status) {
      where.status = String(req.query.status);
    }

    const requests = await db.CustomerRequest.findAll({
      where,
      include: includes,
      order: [["createdAt", "DESC"]],
    });

    return res.json(requests);
  } catch (error) {
    return res.status(500).json({ message: parseApiError(error, "خطا در دریافت درخواست ها") });
  }
});

router.post("/", allowRoles("agent"), async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const phone = normalizeIranPhone(req.body?.phone);
    const company = String(req.body?.company || "").trim();
    const address = String(req.body?.address || "").trim();
    const note = String(req.body?.note || "").trim();

    if (!fullName) {
      return res.status(400).json({ message: "نام مشتری الزامی است" });
    }
    if (!phone) {
      return res.status(400).json({ message: "شماره موبایل معتبر نیست" });
    }

    const [existingCustomer, existingPending] = await Promise.all([
      db.Customer.findOne({
        where: {
          [Op.or]: [{ phone }, { username: phone }],
        },
      }),
      db.CustomerRequest.findOne({
        where: { phone, status: "pending" },
        order: [["createdAt", "DESC"]],
      }),
    ]);

    if (existingCustomer) {
      return res.status(409).json({ message: "این مشتری قبلا در سیستم ثبت شده است" });
    }
    if (existingPending) {
      return res.status(409).json({ message: "برای این شماره قبلا درخواست در انتظار بررسی ثبت شده است" });
    }

    const created = await db.CustomerRequest.create({
      fullName,
      phone,
      company: company || null,
      address: address || null,
      note: note || null,
      status: "pending",
      requesterUserId: req.user.id,
      handledByUserId: null,
    });

    const full = await db.CustomerRequest.findByPk(created.id, { include: includes });
    return res.status(201).json(full);
  } catch (error) {
    return res.status(500).json({ message: parseApiError(error, "خطا در ثبت درخواست مشتری") });
  }
});

router.put("/:id/approve", allowRoles("admin", "user"), async (req, res) => {
  try {
    if (!canApprove(req)) {
      return res.status(403).json({ message: "دسترسی غیرمجاز" });
    }

    const request = await db.CustomerRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ message: "درخواست یافت نشد" });
    if (request.status !== "pending") {
      return res.status(400).json({ message: "این درخواست قبلا بررسی شده است" });
    }

    const phone = normalizeIranPhone(request.phone);
    if (!phone) {
      return res.status(400).json({ message: "شماره موبایل درخواست معتبر نیست" });
    }

    const existingCustomer = await db.Customer.findOne({
      where: {
        [Op.or]: [{ phone }, { username: phone }],
      },
    });
    if (existingCustomer) {
      await request.update({ status: "rejected", handledByUserId: req.user.id });
      return res.status(409).json({ message: "این مشتری قبلا ساخته شده است (درخواست رد شد)" });
    }

    const hashedPassword = await bcrypt.hash(String(phone), 10);

    const customer = await db.Customer.create({
      fullName: request.fullName,
      phone,
      company: request.company || null,
      address: request.address || null,
      supportStatus: null,
      expireDate: null,
      username: phone,
      password: hashedPassword,
      licenseLimit: 1, // نماینده حق تعیین ندارد؛ بعدا ادمین تنظیم می‌کند
      contractStartDate: null,
      contractEndDate: null,
      userId: request.requesterUserId, // مالک مشتری همان نماینده ثبت‌کننده
      isActive: true,
    });

    await request.update({ status: "approved", handledByUserId: req.user.id });

    const updated = await db.CustomerRequest.findByPk(request.id, { include: includes });
    return res.json({ request: updated, customer });
  } catch (error) {
    return res.status(500).json({ message: parseApiError(error, "خطا در تایید درخواست") });
  }
});

router.put("/:id/reject", allowRoles("admin", "user"), async (req, res) => {
  try {
    if (!canApprove(req)) {
      return res.status(403).json({ message: "دسترسی غیرمجاز" });
    }

    const request = await db.CustomerRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ message: "درخواست یافت نشد" });
    if (request.status !== "pending") {
      return res.status(400).json({ message: "این درخواست قبلا بررسی شده است" });
    }

    await request.update({ status: "rejected", handledByUserId: req.user.id });
    const updated = await db.CustomerRequest.findByPk(request.id, { include: includes });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: parseApiError(error, "خطا در رد کردن درخواست") });
  }
});

module.exports = router;

