// routes/stats.routes.js
const router = require("express").Router();
const db = require("../models");
const { auth } = require("../middleware/authorize");
const { Op, fn, col, literal } = require("sequelize");

router.use(auth);

const calcDaysRemaining = (endDate) => {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const contractListIncludes = [
  { model: db.Customer, as: "customer", attributes: ["id", "fullName", "username", "company", "isActive"] },
  { model: db.User, as: "creator", attributes: ["id", "fullName", "username", "role", "isActive"] },
];

const enrichContract = (contract) => {
  const json = contract.toJSON ? contract.toJSON() : contract;
  return { ...json, daysRemaining: calcDaysRemaining(json.endDate) };
};

router.get("/dashboard-lists", async (req, res) => {
  try {
    const role = req.user?.role;
    const today = startOfToday();
    const days = Number(req.query?.days ?? 30);
    const soonDays = Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30;
    const soonUntil = addDays(today, soonDays);

    // ----- Active systems (based on active licenses) -----
    // We return grouped list per systemName to use as a "systems" list in dashboard.
    const licenseWhere = { isActive: true };
    const licenseInclude = [];

    if (role === "customer") {
      licenseWhere.customerId = req.user.id;
    } else if (role === "agent") {
      licenseInclude.push({
        model: db.Customer,
        as: "customer",
        attributes: [],
        where: { userId: req.user.id },
        required: true,
      });
    }

    const activeSystems = await db.License.findAll({
      where: licenseWhere,
      include: licenseInclude,
      attributes: [
        "systemName",
        [fn("COUNT", col("License.id")), "activeLicenses"],
        [fn("COUNT", fn("DISTINCT", col("License.customerId"))), "customersCount"],
        [fn("MAX", col("License.expireDate")), "latestExpireDate"],
      ],
      group: ["systemName"],
      order: [[literal("activeLicenses"), "DESC"]],
      limit: 50,
    });

    const normalizedActiveSystems = activeSystems.map((row) => {
      const json = row.toJSON ? row.toJSON() : row;
      return {
        systemName: json.systemName,
        activeLicenses: Number(json.activeLicenses || 0),
        customersCount: Number(json.customersCount || 0),
        latestExpireDate: json.latestExpireDate || null,
      };
    });

    // ----- Contracts (active + expiring soon) -----
    const contractWhereBase = {};
    if (role === "customer") {
      contractWhereBase.customerId = req.user.id;
    } else if (role === "agent") {
      contractWhereBase.userId = req.user.id;
    }

    const activeContractsWhere = {
      ...contractWhereBase,
      status: "active",
      endDate: { [Op.gte]: today },
    };

    const expiringContractsWhere = {
      ...contractWhereBase,
      status: "active",
      endDate: { [Op.between]: [today, soonUntil] },
    };

    const [activeContracts, expiringSoonContracts] = await Promise.all([
      db.Contract.findAll({
        where: activeContractsWhere,
        include: contractListIncludes,
        order: [["endDate", "ASC"]],
        limit: 50,
      }),
      db.Contract.findAll({
        where: expiringContractsWhere,
        include: contractListIncludes,
        order: [["endDate", "ASC"]],
        limit: 50,
      }),
    ]);

    return res.json({
      activeSystems: normalizedActiveSystems,
      activeContracts: activeContracts.map(enrichContract),
      expiringSoonContracts: expiringSoonContracts.map(enrichContract),
      soonDays,
    });
  } catch (error) {
    console.error("Error fetching dashboard lists:", error);
    return res.status(500).json({ message: "خطا در دریافت لیست های داشبورد" });
  }
});

// روت ۱: آمار کلی
router.get("/dashboard-stats", async (req, res) => {
  try {
    if (req.user.role === "customer") {
      const [licensesCount, contractsCount, messagesCount, pendingRenewals, customer] = await Promise.all([
        db.License.count({ where: { customerId: req.user.id } }),
        db.Contract.count({ where: { customerId: req.user.id } }),
        db.Message.count({ where: { customerId: req.user.id } }),
        db.RenewalRequest.count({ where: { customerId: req.user.id, status: "pending" } }),
        db.Customer.findByPk(req.user.id, { attributes: ["contractEndDate"] }),
      ]);

      const contractEndDate = customer?.contractEndDate || null;
      const contractRemainingDays = calcDaysRemaining(contractEndDate);

      return res.json({
        role: "customer",
        licenses: licensesCount,
        contracts: contractsCount,
        messages: messagesCount,
        pendingRenewals,
        contractEndDate,
        contractRemainingDays,
      });
    }

    if (req.user.role === "agent") {
      const [contractsCount, renewalCount, messagesCount] = await Promise.all([
        db.Contract.count({ where: { userId: req.user.id } }),
        db.RenewalRequest.count({ where: { requesterUserId: req.user.id } }),
        db.Message.count({ where: { userId: req.user.id } }),
      ]);

      return res.json({
        role: "agent",
        contracts: contractsCount,
        renewalRequests: renewalCount,
        messages: messagesCount,
      });
    }

    const [usersCount, customersCount, messagesCount, contractsCount] = await Promise.all([
      db.User.count(),
      db.Customer.count(),
      db.Message.count(),
      db.Contract.count(),
    ]);
    
    const activeUsers = Math.floor(usersCount * 0.15); 
    
    res.json({
      users: usersCount,
      customers: customersCount,
      messages: messagesCount,
      contracts: contractsCount,
      activeUsers: activeUsers
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "خطا در دریافت آمار" });
  }
});

// روت ۲: آخرین فعالیت‌ها (آخرین مشتریان ثبت‌نام شده)
router.get("/recent-activity", async (req, res) => {
  try {
    if (req.user.role === "customer") {
      return res.json([]);
    }

    if (req.user.role === "agent") {
      const [recentContracts, recentRequests] = await Promise.all([
        db.Contract.findAll({
          where: { userId: req.user.id },
          order: [["createdAt", "DESC"]],
          limit: 5,
          attributes: ["title", "createdAt"],
        }),
        db.RenewalRequest.findAll({
          where: { requesterUserId: req.user.id },
          order: [["createdAt", "DESC"]],
          limit: 5,
          attributes: ["title", "status", "createdAt"],
        }),
      ]);

      const activities = [
        ...recentContracts.map((item) => ({
          user: "قرارداد",
          action: `قرارداد ${item.title} ثبت شد`,
          date: new Date(item.createdAt).toLocaleDateString("fa-IR"),
          createdAt: item.createdAt,
          status: "success",
          type: "contract",
        })),
        ...recentRequests.map((item) => ({
          user: "تمدید",
          action: `${item.title} (${item.status})`,
          date: new Date(item.createdAt).toLocaleDateString("fa-IR"),
          createdAt: item.createdAt,
          status: "success",
          type: "renewal",
        })),
      ]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 8)
        .map(({ createdAt, ...rest }) => rest);

      return res.json(activities);
    }

    const [recentCustomers, recentMessages] = await Promise.all([
      db.Customer.findAll({
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: ["fullName", "phone", "createdAt"],
      }),
      db.Message.findAll({
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: ["sender", "text", "createdAt", "senderType"],
      }),
    ]);

    const customerActivities = recentCustomers.map((customer) => ({
      user: customer.fullName || customer.phone || "کاربر ناشناس",
      action: "مشتری جدید ثبت‌نام کرد",
      date: new Date(customer.createdAt).toLocaleDateString("fa-IR"),
      createdAt: customer.createdAt,
      status: "success",
      type: "customer",
    }));

    const messageActivities = recentMessages.map((message) => ({
      user: message.sender || "ناشناس",
      action: message.text,
      date: new Date(message.createdAt).toLocaleDateString("fa-IR"),
      createdAt: message.createdAt,
      status: "success",
      type: "message",
    }));

    const activities = [...customerActivities, ...messageActivities]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8)
      .map(({ createdAt, ...item }) => item);

    res.json(activities);
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    res.json([]);
  }
});

module.exports = router;


