const router = require("express").Router();
const db = require("../models");
const { auth, allowRoles } = require("../middleware/authorize");

router.use(auth);

const parseDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const calcDaysRemaining = (endDate) => {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
};

const enrichContract = (contract) => {
  const json = contract.toJSON ? contract.toJSON() : contract;
  return {
    ...json,
    daysRemaining: calcDaysRemaining(json.endDate),
  };
};

router.get("/", async (req, res) => {
  try {
    const where = {};
    const role = req.user.role;

    if (role === "customer") {
      where.customerId = req.user.id;
    } else if (role === "agent") {
      where.userId = req.user.id;
    }

    if (req.query.customerId && role !== "customer") {
      where.customerId = Number(req.query.customerId);
    }

    const contracts = await db.Contract.findAll({
      where,
      include: [
        { model: db.Customer, as: "customer", attributes: ["id", "fullName", "username", "company"] },
        { model: db.User, as: "creator", attributes: ["id", "fullName", "username", "role"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json(contracts.map(enrichContract));
  } catch (error) {
    return res.status(500).json({ message: "خطا در دریافت قراردادها" });
  }
});

router.get("/customers/options", allowRoles("admin", "user"), async (req, res) => {
  try {
    const customers = await db.Customer.findAll({
      attributes: ["id", "fullName", "company", "isActive"],
      order: [["fullName", "ASC"]],
    });
    return res.json(customers);
  } catch (error) {
    return res.status(500).json({ message: "خطا در دریافت مشتریان" });
  }
});

router.post("/", allowRoles("admin", "user"), async (req, res) => {
  try {
    const { title, amount, startDate, endDate, description, status, customerId } = req.body;

    if (!title || !amount || !startDate || !endDate || !customerId) {
      return res.status(400).json({ message: "عنوان، مبلغ، تاریخ شروع، تاریخ پایان و مشتری الزامی است" });
    }

    const parsedStart = parseDate(startDate);
    const parsedEnd = parseDate(endDate);
    if (!parsedStart || !parsedEnd) {
      return res.status(400).json({ message: "فرمت تاریخ نامعتبر است" });
    }
    if (parsedEnd < parsedStart) {
      return res.status(400).json({ message: "تاریخ پایان باید بعد از تاریخ شروع باشد" });
    }

    const customer = await db.Customer.findByPk(Number(customerId));
    if (!customer) {
      return res.status(404).json({ message: "مشتری یافت نشد" });
    }

    const contract = await db.Contract.create({
      title,
      amount: Number(amount),
      startDate: parsedStart,
      endDate: parsedEnd,
      description: description || null,
      status: status || "active",
      customerId: customer.id,
      userId: req.user.id,
    });

    await customer.update({
      contractStartDate: parsedStart,
      contractEndDate: parsedEnd,
      expireDate: parsedEnd,
    });

    const created = await db.Contract.findByPk(contract.id, {
      include: [
        { model: db.Customer, as: "customer", attributes: ["id", "fullName", "username", "company"] },
        { model: db.User, as: "creator", attributes: ["id", "fullName", "username", "role"] },
      ],
    });

    return res.status(201).json(enrichContract(created));
  } catch (error) {
    return res.status(500).json({ message: "خطا در ایجاد قرارداد" });
  }
});

router.put("/:id", allowRoles("admin", "user"), async (req, res) => {
  try {
    const contract = await db.Contract.findByPk(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: "قرارداد یافت نشد" });
    }

    const updatePayload = { ...req.body };

    if (updatePayload.startDate) {
      const parsed = parseDate(updatePayload.startDate);
      if (!parsed) return res.status(400).json({ message: "تاریخ شروع نامعتبر است" });
      updatePayload.startDate = parsed;
    }
    if (updatePayload.endDate) {
      const parsed = parseDate(updatePayload.endDate);
      if (!parsed) return res.status(400).json({ message: "تاریخ پایان نامعتبر است" });
      updatePayload.endDate = parsed;
    }
    if (updatePayload.amount !== undefined) {
      updatePayload.amount = Number(updatePayload.amount);
    }

    if (updatePayload.customerId) {
      const customer = await db.Customer.findByPk(Number(updatePayload.customerId));
      if (!customer) return res.status(404).json({ message: "مشتری یافت نشد" });
      updatePayload.customerId = customer.id;
    }

    await contract.update(updatePayload);

    if (contract.customerId) {
      const latest = await db.Contract.findOne({
        where: { customerId: contract.customerId },
        order: [["endDate", "DESC"]],
      });
      if (latest) {
        const customer = await db.Customer.findByPk(contract.customerId);
        if (customer) {
          await customer.update({
            contractStartDate: latest.startDate,
            contractEndDate: latest.endDate,
            expireDate: latest.endDate,
          });
        }
      }
    }

    const updated = await db.Contract.findByPk(contract.id, {
      include: [
        { model: db.Customer, as: "customer", attributes: ["id", "fullName", "username", "company"] },
        { model: db.User, as: "creator", attributes: ["id", "fullName", "username", "role"] },
      ],
    });

    return res.json(enrichContract(updated));
  } catch (error) {
    return res.status(500).json({ message: "خطا در ویرایش قرارداد" });
  }
});

router.delete("/:id", allowRoles("admin", "user"), async (req, res) => {
  try {
    const contract = await db.Contract.findByPk(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: "قرارداد یافت نشد" });
    }

    const customerId = contract.customerId;
    await contract.destroy();

    const latest = await db.Contract.findOne({
      where: { customerId },
      order: [["endDate", "DESC"]],
    });

    const customer = await db.Customer.findByPk(customerId);
    if (customer) {
      await customer.update({
        contractStartDate: latest?.startDate || null,
        contractEndDate: latest?.endDate || null,
        expireDate: latest?.endDate || null,
      });
    }

    return res.json({ message: "قرارداد حذف شد" });
  } catch (error) {
    return res.status(500).json({ message: "خطا در حذف قرارداد" });
  }
});

module.exports = router;


