const cron = require("node-cron");
const { runContractExpirySmsJob } = require("./contractExpirySmsJob");

const scheduleJobs = (db) => {
  const cronExpr = process.env.SMS_CONTRACT_EXPIRY_CRON || "0 9 * * *";
  const timezone = process.env.SMS_CRON_TZ || "Asia/Tehran";

  cron.schedule(
    cronExpr,
    async () => {
      try {
        const result = await runContractExpirySmsJob(db);
        if (result?.skipped) {
          console.log("SMS job skipped:", result.reason);
        } else {
          console.log("SMS job finished:", result?.totals || result);
        }
      } catch (err) {
        console.error("SMS job failed:", err);
      }
    },
    { timezone },
  );

  console.log(`🟦 SMS scheduler: contract expiry job scheduled (${cronExpr}, tz=${timezone})`);
};

module.exports = {
  scheduleJobs,
};

