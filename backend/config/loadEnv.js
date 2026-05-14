const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Loads env from a deterministic location so running from repo root or /backend behaves the same.
// Priority:
// 1) ENV_FILE (absolute or relative to backend/)
// 2) backend/.env.<NODE_ENV>
// 3) backend/.env
module.exports = () => {
  if (process.env.__BACKEND_ENV_LOADED__) return;

  const backendDir = path.resolve(__dirname, "..");
  const nodeEnv = String(process.env.NODE_ENV || "").trim() || "development";

  const candidates = [];

  if (process.env.ENV_FILE) {
    const raw = String(process.env.ENV_FILE).trim();
    candidates.push(path.isAbsolute(raw) ? raw : path.join(backendDir, raw));
  }

  candidates.push(path.join(backendDir, `.env.${nodeEnv}`));
  candidates.push(path.join(backendDir, ".env"));

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        dotenv.config({ path: filePath });
        process.env.__BACKEND_ENV_LOADED__ = "1";
        process.env.__BACKEND_ENV_FILE__ = filePath;
        return;
      }
    } catch {
      // ignore and try next candidate
    }
  }

  // Fallback to default dotenv behavior (CWD-based).
  dotenv.config();
  process.env.__BACKEND_ENV_LOADED__ = "1";
  process.env.__BACKEND_ENV_FILE__ = "default";
};

