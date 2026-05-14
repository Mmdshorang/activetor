# مدیریت مشتریان حساب بان

## پیامک OTP و یادآوری پایان قرارداد (کاوه‌نگار)

این پروژه برای OTP و همچنین پیامک یادآوری پایان قرارداد از سرویس `lookup` کاوه‌نگار استفاده می‌کند.

### 1) متغیرهای محیطی لازم

در بک‌اند (برای اجرا بدون Docker) این موارد را در یکی از فایل‌ها تنظیم کنید:
- `backend/.env.development` (لوکال)
- `backend/.env.production` (محیط پروداکشن یا تست پروداکشن)

و با `NODE_ENV` سوییچ کنید (مثلا `NODE_ENV=development` یا `NODE_ENV=production`).

- `KAVENEGAR_API_KEY`: کلید API کاوه‌نگار
- `KAVENEGAR_TEMPLATE`: نام template برای OTP (مثلا `verify`)
- `KAVENEGAR_TYPE`: معمولا `sms`
- `KAVENEGAR_CONTRACT_EXPIRE_TEMPLATE`: نام template یادآوری پایان قرارداد
- `SMS_CONTRACT_EXPIRY_ENABLED_DEFAULT`: پیش‌فرض فعال/غیرفعال بودن (true/false)
- `SMS_CONTRACT_EXPIRY_DAYS_BEFORE_END`: چند روز مانده به پایان (پیشنهاد: 5)
- `SMS_CONTRACT_EXPIRY_CRON`: زمان‌بندی اجرای job (cron) (پیش‌فرض: `0 9 * * *`)
- `SMS_CRON_TZ`: تایم‌زون کرون (پیش‌فرض: `Asia/Tehran`)

نمونه در `.env.example` موجود است.

### اجرای لوکال/پروداکشن (سوییچ راحت)

- بک‌اند:
  - لوکال: `cd backend` سپس `npm run start:dev`
  - پروداکشن: `cd backend` سپس `npm run start:prod`
- فرانت:
  - لوکال: `cd frontend` سپس `npm start`
  - بیلد پروداکشن: `cd frontend` سپس `npm run build`

برای Docker هم `.env.example` را به `.env` در روت پروژه کپی کنید و سپس `docker-compose up --build`.

### 2) بعد از خرید پیامک چه چیزهایی را باید تغییر بدهم؟

1. در پنل کاوه‌نگار یک `Lookup Template` بسازید.
2. نام template را در `backend/.env` داخل `KAVENEGAR_CONTRACT_EXPIRE_TEMPLATE` بگذارید.
3. متن template را طوری تنظیم کنید که 3 توکن زیر را بپذیرد (مطابق lookup کاوه‌نگار):
   - `token`: تعداد روز مانده (مثلا `5`)
   - `token2`: عنوان قرارداد
   - `token3`: تاریخ پایان قرارداد (yyyy-mm-dd)
4. `KAVENEGAR_API_KEY` را با کلید واقعی جایگزین کنید.
5. اگر نیاز دارید ساعت ارسال تغییر کند، `SMS_CONTRACT_EXPIRY_CRON` را عوض کنید.

### 3) فعال/غیرفعال کردن توسط ادمین

ادمین می‌تواند این قابلیت را از داشبورد روشن/خاموش کند (و `daysBeforeEnd` و `template` را هم تغییر دهد).
API مربوطه:

- `GET /api/settings/sms-contract-expiry`
- `PUT /api/settings/sms-contract-expiry`
- `POST /api/settings/sms-contract-expiry/run` (اجرای دستی برای تست)
