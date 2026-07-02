/**
 * Ensures the target database exists before migrations run. Connects to the
 * server without selecting a database, then CREATE DATABASE IF NOT EXISTS.
 * Idempotent and safe to run repeatedly.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const url = new URL(process.env.DATABASE_URL!);
const database = url.pathname.replace(/^\//, "") || "pleyad";

const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port) || 4000,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
});

await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
console.log(`✓ Database '${database}' is ready.`);
await conn.end();
