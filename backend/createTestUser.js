// server.js (یا فایل اصلی شما)

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const db = require("./models"); // مسیر فایل models خود را چک کنید

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// ---------- شروع بخش ساخت کاربر تستی ----------
async function seedTestUser() {
  try {
    const bcrypt = require("bcryptjs");
    
    // فرض بر این است که مدل User شما در اینجا موجود است
    // اگر مدل شما نام دیگری دارد، 'User' را تغییر دهید
    const User = db.User; 

    // چک می‌کنیم اگر کاربری با این نام وجود دارد، کاری نکنیم
    const existingUser = await User.findOne({ where: { username: "admin" } });

    if (existingUser) {
      console.log("✅ کاربر تستی (admin) از قبل وجود دارد.");
    } else {
      const hashedPassword = await bcrypt.hash("123456", 10);
      
      await User.create({
        username: "admin",
        password: hashedPassword,
        fullName:"mm",
        email: "admin@test.com",
        role: "admin" // یا هر نقشی که مد نظر دارید
      });
      
      console.log("✅ کاربر تستی با موفقیت ساخته شد:");
      console.log("   نام کاربری: admin");
      console.log("   رمز عبور: 123456");
    }
  } catch (error) {
    console.error("❌ خطا در ساخت کاربر تستی:", error.message);
  }
}

// این تابع را فقط یک بار اجرا می‌کنیم
// اگر می‌خواهید همیشه چک شود، این خط را نگه دارید.
// اگر فقط یک بار می‌خواهید ساخته شود، بعد از اجرای موفق، این خط را کامنت کنید.
seedTestUser();
// ---------- پایان بخش ساخت کاربر تستی ----------

// اتصال به دیتابیس و شروع سرور
db.sequelize.authenticate()
  .then(() => {
    console.log("Connected to database.");
    
    // اگر می‌خواهید دیتابیس را هم‌زمان با سرور سینک کنید (فقط برای تست)
    // db.sequelize.sync({ force: true }) // هشدار: این همه دیتابیس را پاک می‌کند!
    // یا بهتر است از migrate استفاده کنید
    
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => {
    console.error("Unable to connect to the database:", err);
  });