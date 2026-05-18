const router = require("express").Router();
const db = require("../models");
const { auth, allowRoles } = require("../middleware/authorize");
const { parseDateOnly, daysBetweenUtc, todayUtcYmd } = require("../utils/dateOnly");

router.use(auth);

const calcDaysRemaining = (endDate) => {
  if (!endDate) return null;
  // endDate is DATEONLY ("YYYY-MM-DD") - compute in UTC to avoid timezone shifts.
  return daysBetweenUtc(todayUtcYmd(), String(endDate).slice(0, 10));
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
    return res.status(500).json({ message: "Ø®Ø·Ø§ Ø¯Ø± Ø¯Ø±ÛŒØ§ÙØª Ù‚Ø±Ø§Ø±Ø¯Ø§Ø¯Ù‡Ø§" });
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
    return res.status(500).json({ message: "Ø®Ø·Ø§ Ø¯Ø± Ø¯Ø±ÛŒØ§ÙØª Ù…Ø´ØªØ±ÛŒØ§Ù†" });
  }
});

router.post("/", allowRoles("admin", "user"), async (req, res) => {
  try {
    const { title, amount, startDate, endDate, description, status, customerId } = req.body;

    if (!title || !amount || !startDate || !endDate || !customerId) {
      return res.status(400).json({ message: "Ø¹Ù†ÙˆØ§Ù†ØŒ Ù…Ø¨Ù„ØºØŒ ØªØ§Ø±ÛŒØ® Ø´Ø±ÙˆØ¹ØŒ ØªØ§Ø±ÛŒØ® Ù¾Ø§ÛŒØ§Ù† Ùˆ Ù…Ø´ØªØ±ÛŒ Ø§Ù„Ø²Ø§Ù…ÛŒ Ø§Ø³Øª" });
    }

    const parsedStart = parseDateOnly(startDate);
    const parsedEnd = parseDateOnly(endDate);
    if (!parsedStart || !parsedEnd) {
      return res.status(400).json({ message: "ÙØ±Ù…Øª ØªØ§Ø±ÛŒØ® Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª" });
    }
    if (parsedEnd < parsedStart) {
      return res.status(400).json({ message: "ØªØ§Ø±ÛŒØ® Ù¾Ø§ÛŒØ§Ù† Ø¨Ø§ÛŒØ¯ Ø¨Ø¹Ø¯ Ø§Ø² ØªØ§Ø±ÛŒØ® Ø´Ø±ÙˆØ¹ Ø¨Ø§Ø´Ø¯" });
    }

    const customer = await db.Customer.findByPk(Number(customerId));
    if (!customer) {
      return res.status(404).json({ message: "Ù…Ø´ØªØ±ÛŒ ÛŒØ§ÙØª Ù†Ø´Ø¯" });
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
    return res.status(500).json({ message: "Ø®Ø·Ø§ Ø¯Ø± Ø§ÛŒØ¬Ø§Ø¯ Ù‚Ø±Ø§Ø±Ø¯Ø§Ø¯" });
  }
});

router.put("/:id", allowRoles("admin", "user"), async (req, res) => {
  try {
    const contract = await db.Contract.findByPk(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: "Ù‚Ø±Ø§Ø±Ø¯Ø§Ø¯ ÛŒØ§ÙØª Ù†Ø´Ø¯" });
    }

    const updatePayload = { ...req.body };

    if (updatePayload.startDate) {
      const parsed = parseDateOnly(updatePayload.startDate);
      if (!parsed) return res.status(400).json({ message: "ØªØ§Ø±ÛŒØ® Ø´Ø±ÙˆØ¹ Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª" });
      updatePayload.startDate = parsed;
    }
    if (updatePayload.endDate) {
      const parsed = parseDateOnly(updatePayload.endDate);
      if (!parsed) return res.status(400).json({ message: "ØªØ§Ø±ÛŒØ® Ù¾Ø§ÛŒØ§Ù† Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª" });
      updatePayload.endDate = parsed;
    }
    if (updatePayload.amount !== undefined) {
      updatePayload.amount = Number(updatePayload.amount);
    }

    if (updatePayload.customerId) {
      const customer = await db.Customer.findByPk(Number(updatePayload.customerId));
      if (!customer) return res.status(404).json({ message: "Ù…Ø´ØªØ±ÛŒ ÛŒØ§ÙØª Ù†Ø´Ø¯" });
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
    return res.status(500).json({ message: "Ø®Ø·Ø§ Ø¯Ø± ÙˆÛŒØ±Ø§ÛŒØ´ Ù‚Ø±Ø§Ø±Ø¯Ø§Ø¯" });
  }
});

router.delete("/:id", allowRoles("admin", "user"), async (req, res) => {
  try {
    const contract = await db.Contract.findByPk(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: "Ù‚Ø±Ø§Ø±Ø¯Ø§Ø¯ ÛŒØ§ÙØª Ù†Ø´Ø¯" });
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

    return res.json({ message: "Ù‚Ø±Ø§Ø±Ø¯Ø§Ø¯ Ø­Ø°Ù Ø´Ø¯" });
  } catch (error) {
    return res.status(500).json({ message: "Ø®Ø·Ø§ Ø¯Ø± Ø­Ø°Ù Ù‚Ø±Ø§Ø±Ø¯Ø§Ø¯" });
  }
});

module.exports = router;

