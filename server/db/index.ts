import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// TiDB Cloud (and most managed MySQL) requires TLS on the connection.
const useSsl = connectionString.includes("tidbcloud.com");

export const pool = mysql.createPool({
  uri: connectionString,
  ssl: useSsl ? { minVersion: "TLSv1.2" } : undefined,
});
export const db = drizzle(pool, { schema, mode: "default" });
