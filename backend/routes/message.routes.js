const router = require("express").Router();
const db = require("../models");
const auth = require("../middleware/auth");

router.use(auth);

const messageIncludes = [
  {
    model: db.Customer,
    as: "customer",
    attributes: ["id", "fullName", "username"],
  },
  {
    model: db.User,
    as: "user",
    attributes: ["id", "fullName", "username", "role"],
  },
];

const isCustomer = (req) => req.user?.role === "customer" || req.user?.userType === "customer";
const isAgent = (req) => req.user?.role === "agent";
const canManageConversations = (req) => req.user?.role === "admin" || req.user?.role === "user";

router.get("/", async (req, res) => {
  try {
    const where = {};

    if (isCustomer(req)) {
      where.customerId = req.user.id;
    } else if (isAgent(req)) {
      where.customerId = null;
      where.userId = req.user.id;
    } else if (canManageConversations(req)) {
      if (req.query.customerId) {
        const parsedCustomerId = Number(req.query.customerId);
        if (!parsedCustomerId) {
          return res.status(400).json({ message: "شناسه مشتری نامعتبر است" });
        }
        where.customerId = parsedCustomerId;
      } else if (req.query.agentUserId) {
        const parsedAgentId = Number(req.query.agentUserId);
        if (!parsedAgentId) {
          return res.status(400).json({ message: "شناسه نماینده نامعتبر است" });
        }
        where.customerId = null;
        where.userId = parsedAgentId;
      }
    } else {
      return res.status(403).json({ message: "دسترسی غیرمجاز" });
    }

    const messages = await db.Message.findAll({
      where,
      include: messageIncludes,
      order: [["createdAt", "ASC"]],
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "خطا در دریافت پیام ها" });
  }
});

router.get("/conversations", async (req, res) => {
  try {
    if (!canManageConversations(req)) {
      return res.status(403).json({ message: "فقط ادمین یا کاربر داخلی به گفتگوها دسترسی دارد" });
    }

    const [customers, agents] = await Promise.all([
      db.Customer.findAll({
        attributes: ["id", "fullName", "username", "isActive"],
        order: [["fullName", "ASC"]],
      }),
      db.User.findAll({
        where: { role: "agent" },
        attributes: ["id", "fullName", "username", "isActive"],
        order: [["fullName", "ASC"]],
      }),
    ]);

    const customerConversations = await Promise.all(
      customers.map(async (customer) => {
        const [lastMessage, unreadCount] = await Promise.all([
          db.Message.findOne({
            where: { customerId: customer.id },
            order: [["createdAt", "DESC"]],
          }),
          db.Message.count({
            where: {
              customerId: customer.id,
              senderType: "customer",
              isReadByUser: false,
            },
          }),
        ]);

        return {
          type: "customer",
          customer,
          lastMessage,
          unreadCount,
        };
      }),
    );

    const agentConversations = await Promise.all(
      agents.map(async (agent) => {
        const [lastMessage, unreadCount] = await Promise.all([
          db.Message.findOne({
            where: { customerId: null, userId: agent.id },
            order: [["createdAt", "DESC"]],
          }),
          db.Message.count({
            where: {
              customerId: null,
              userId: agent.id,
              senderType: "user",
              isReadByUser: false,
            },
          }),
        ]);

        return {
          type: "agent",
          agent,
          lastMessage,
          unreadCount,
        };
      }),
    );

    const filtered = [...customerConversations, ...agentConversations].filter((item) => item.lastMessage);
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: "خطا در دریافت گفتگوها" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { text, customerId, agentUserId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "متن پیام الزامی است" });
    }

    if (isCustomer(req)) {
      const customer = await db.Customer.findByPk(req.user.id);
      if (!customer) {
        return res.status(404).json({ message: "مشتری یافت نشد" });
      }

      const newMessage = await db.Message.create({
        sender: customer.fullName || customer.username,
        senderType: "customer",
        text: text.trim(),
        customerId: customer.id,
        userId: null,
        isReadByCustomer: true,
        isReadByUser: false,
      });

      const created = await db.Message.findByPk(newMessage.id, { include: messageIncludes });
      return res.status(201).json(created);
    }

    if (isAgent(req)) {
      const senderUser = await db.User.findByPk(req.user.id);
      const newMessage = await db.Message.create({
        sender: senderUser?.fullName || senderUser?.username || "نماینده",
        senderType: "user",
        text: text.trim(),
        customerId: null,
        userId: req.user.id,
        isReadByCustomer: true,
        isReadByUser: false,
      });

      const created = await db.Message.findByPk(newMessage.id, { include: messageIncludes });
      return res.status(201).json(created);
    }

    if (canManageConversations(req)) {
      const senderUser = await db.User.findByPk(req.user.id);

      if (agentUserId) {
        const parsedAgentUserId = Number(agentUserId);
        if (!parsedAgentUserId) {
          return res.status(400).json({ message: "شناسه نماینده نامعتبر است" });
        }
        const targetAgent = await db.User.findOne({ where: { id: parsedAgentUserId, role: "agent" } });
        if (!targetAgent) {
          return res.status(404).json({ message: "نماینده یافت نشد" });
        }

        const newMessage = await db.Message.create({
          sender: senderUser?.fullName || senderUser?.username || "کاربر سیستم",
          senderType: "user",
          text: text.trim(),
          customerId: null,
          userId: targetAgent.id,
          isReadByCustomer: false,
          isReadByUser: true,
        });

        const created = await db.Message.findByPk(newMessage.id, { include: messageIncludes });
        return res.status(201).json(created);
      }

      const normalizedCustomerId = Number(customerId);
      if (!normalizedCustomerId) {
        return res.status(400).json({ message: "شناسه مشتری الزامی است" });
      }

      const customer = await db.Customer.findByPk(normalizedCustomerId);
      if (!customer) {
        return res.status(404).json({ message: "مشتری یافت نشد" });
      }

      const newMessage = await db.Message.create({
        sender: senderUser?.fullName || senderUser?.username || "کاربر سیستم",
        senderType: "user",
        text: text.trim(),
        customerId: normalizedCustomerId,
        userId: senderUser?.id || null,
        isReadByCustomer: false,
        isReadByUser: true,
      });

      const created = await db.Message.findByPk(newMessage.id, { include: messageIncludes });
      return res.status(201).json(created);
    }

    return res.status(403).json({ message: "دسترسی غیرمجاز" });
  } catch (err) {
    res.status(500).json({ message: "خطا در ایجاد پیام" });
  }
});

router.put("/mark-read", async (req, res) => {
  try {
    const { customerId, agentUserId } = req.body;
    const where = {};

    if (isCustomer(req)) {
      where.customerId = req.user.id;
      where.senderType = "user";
      where.isReadByCustomer = false;
      await db.Message.update({ isReadByCustomer: true }, { where });
      return res.json({ message: "پیام‌ها خوانده شد" });
    }

    if (isAgent(req)) {
      where.customerId = null;
      where.userId = req.user.id;
      where.senderType = "user";
      where.isReadByCustomer = false;
      await db.Message.update({ isReadByCustomer: true }, { where });
      return res.json({ message: "پیام‌ها خوانده شد" });
    }

    if (!canManageConversations(req)) {
      return res.status(403).json({ message: "دسترسی غیرمجاز" });
    }

    if (agentUserId) {
      where.customerId = null;
      where.userId = Number(agentUserId);
      where.senderType = "user";
      where.isReadByUser = false;
      await db.Message.update({ isReadByUser: true }, { where });
      return res.json({ message: "پیام‌ها خوانده شد" });
    }

    if (!customerId) {
      return res.status(400).json({ message: "شناسه مشتری یا نماینده الزامی است" });
    }

    where.customerId = Number(customerId);
    where.senderType = "customer";
    where.isReadByUser = false;

    await db.Message.update({ isReadByUser: true }, { where });
    return res.json({ message: "پیام‌ها خوانده شد" });
  } catch (error) {
    return res.status(500).json({ message: "خطا در علامت‌گذاری پیام ها" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!canManageConversations(req)) {
      return res.status(403).json({ message: "اجازه حذف پیام ندارید" });
    }

    const message = await db.Message.findByPk(req.params.id);
    if (!message) {
      return res.status(404).json({ message: "پیام یافت نشد" });
    }

    await message.destroy();
    res.json({ message: "پیام با موفقیت حذف شد" });
  } catch (err) {
    res.status(500).json({ message: "خطا در حذف پیام" });
  }
});

module.exports = router;


