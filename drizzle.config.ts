import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL || "mysql://root:root@localhost:3306/club_sponsor";
const useSsl = connectionString.includes("tidbcloud.com");

function parseConnectionString(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  };
}

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "mysql",
  dbCredentials: useSsl
    ? { ...parseConnectionString(connectionString), ssl: { minVersion: "TLSv1.2" } }
    : { url: connectionString },
});
