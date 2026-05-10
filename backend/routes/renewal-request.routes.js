const router = require("express").Router();
const db = require("../models");
const { auth, allowRoles } = require("../middleware/authorize");

router.use(auth);

const includes = [
  { model: db.Contract, as: "contract", attributes: ["id", "title", "startDate", "endDate", "status"] },
  { model: db.Customer, as: "customer", attributes: ["id", "fullName", "username", "company"] },
  { model: db.User, as: "requesterUser", attributes: ["id", "fullName", "username", "role"] },
  { model: db.User, as: "handlerUser", attributes: ["id", "fullName", "username", "role"] },
];

router.get("/", async (req, res) => {
  try {
    const role = req.user.role;
    const where = {};

    if (role === "customer") {
      where.customerId = req.user.id;
    } else if (role === "agent") {
      where.requesterUserId = req.user.id;
    } else if (req.query.status) {
      where.status = req.query.status;
    }

    const requests = await db.RenewalRequest.findAll({
      where,
      include: includes,
      order: [["createdAt", "DESC"]],
    });

    return res.json(requests);
  } catch (error) {
    return res.status(500).json({ message: "خطا در دریافت درخواست های تمدید" });
  }
});

router.post("/", allowRoles("customer", "agent", "user", "admin"), async (req, res) => {
  try {
    const { contractId, title, message } = req.body;
    const role = req.user.role;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "عنوان درخواست الزامی است" });
    }

    let contract = null;
    let customerId = null;
    if (contractId) {
      contract = await db.Contract.findByPk(Number(contractId));
      if (!contract) return res.status(404).json({ message: "قرارداد یافت نشد" });
    }

    if (role === "customer") {
      customerId = req.user.id;
      if (contract && contract.customerId !== customerId) {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }
    } else if (role === "agent") {
      if (contract && contract.userId !== req.user.id) {
        return res.status(403).json({ message: "دسترسی غیرمجاز" });
      }
      customerId = contract ? contract.customerId : null;
    } else {
      customerId = contract ? contract.customerId : Number(req.body.customerId || 0) || null;
    }

    const created = await db.RenewalRequest.create({
      title: title.trim(),
      message: message?.trim() || null,
      status: "pending",
      requesterRole: role,
      contractId: contract ? contract.id : null,
      customerId,
      requesterUserId: role === "customer" ? null : req.user.id,
      handledByUserId: null,
    });

    const full = await db.RenewalRequest.findByPk(created.id, { include: includes });
    return res.status(201).json(full);
  } catch (error) {
    return res.status(500).json({ message: "خطا در ایجاد درخواست تمدید" });
  }
});

router.put("/:id/status", allowRoles("admin", "user"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "وضعیت نامعتبر است" });
    }

    const request = await db.RenewalRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ message: "درخواست یافت نشد" });

    await request.update({
      status,
      handledByUserId: req.user.id,
    });

    const updated = await db.RenewalRequest.findByPk(request.id, { include: includes });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: "خطا در به‌روزرسانی درخواست تمدید" });
  }
});

module.exports = router;


