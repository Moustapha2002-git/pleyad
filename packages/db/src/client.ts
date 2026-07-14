import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const raw = process.env.DATABASE_URL;
if (!raw) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}
// Tolerate values pasted with surrounding quotes or stray whitespace — a common
// mistake when copying from a .env file (DATABASE_URL="…") into a hosting dashboard.
const url = raw.trim().replace(/^['"]|['"]$/g, "").trim();

// Parse the connection string and connect with explicit TLS. TiDB Cloud's public
// endpoint requires TLS; its gateway presents a publicly-trusted certificate, so
// Node's built-in CA store verifies it — no CA file needed.
let parsed: URL;
try {
  parsed = new URL(url);
} catch {
  throw new Error(
    `DATABASE_URL is not a valid URL. Expected mysql://user:pass@host:port/db — ` +
      `got ${url.length} chars starting "${url.slice(0, 12)}". Remove any quotes or spaces.`,
  );
}
const pool = mysql.createPool({
  host: parsed.hostname,
  port: Number(parsed.port) || 4000,
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: parsed.pathname.replace(/^\//, ""),
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
});

export const db = drizzle(pool, { schema, mode: "default" });
export type DB = typeof db;
