import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Parse DATABASE_URL into explicit credentials so we can attach TLS, which
// TiDB Cloud's public endpoint requires.
const url = new URL(process.env.DATABASE_URL!);

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  },
  strict: true,
  verbose: true,
});
