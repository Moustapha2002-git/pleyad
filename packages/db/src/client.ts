import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// Parse the connection string and connect with explicit TLS. TiDB Cloud's public
// endpoint requires TLS; its gateway presents a publicly-trusted certificate, so
// Node's built-in CA store verifies it — no CA file needed.
const parsed = new URL(url);
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
