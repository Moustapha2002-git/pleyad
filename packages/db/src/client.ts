import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// A single shared pool for the process. TiDB Cloud requires TLS; the `ssl`
// parameter is carried in the connection string (see .env.example).
const pool = mysql.createPool(url);

export const db = drizzle(pool, { schema, mode: "default" });
export type DB = typeof db;
