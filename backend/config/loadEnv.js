const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Loads env from a deterministic location so running from repo root or /backend behaves the same.
// Strategy:
// 1) Load base backend/.env (if present).
// 2) Load backend/.env.<NODE_ENV> (if present), overriding base.
// 3) If ENV_FILE is provided, load it last (highest priority), overriding prior values.
module.exports = () => {
  if (process.env.__BACKEND_ENV_LOADED__) return;

  const backendDir = path.resolve(__dirname, "..");
  const nodeEnv = String(process.env.NODE_ENV || "").trim() || "development";

  const baseEnvPath = path.join(backendDir, ".env");
  const scopedEnvPath = path.join(backendDir, `.env.${nodeEnv}`);
  const envFilePath = process.env.ENV_FILE
    ? (() => {
        const raw = String(process.env.ENV_FILE).trim();
        return path.isAbsolute(raw) ? raw : path.join(backendDir, raw);
      })()
    : null;

  const loaded = [];

  const tryLoad = (filePath, override) => {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) {
        dotenv.config({ path: filePath, override });
        loaded.push(filePath);
      }
    } catch {
      // ignore
    }
  };

  // Lowest priority first, then overrides.
  tryLoad(baseEnvPath, false);
  tryLoad(scopedEnvPath, true);
  tryLoad(envFilePath, true);

  if (loaded.length) {
    process.env.__BACKEND_ENV_LOADED__ = "1";
    process.env.__BACKEND_ENV_FILE__ = loaded.join(" | ");
    return;
  }

  // Fallback to default dotenv behavior (CWD-based).
  dotenv.config();
  process.env.__BACKEND_ENV_LOADED__ = "1";
  process.env.__BACKEND_ENV_FILE__ = "default";
};
