import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./trpc/routers/_app";
import { createContext } from "./trpc/trpc";
import { runSeed } from "./db/seed";
import { startHeartbeat } from "./lib/cron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";

async function start() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json({ limit: "25mb" }));

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  if (isProduction) {
    const clientDist = path.resolve(__dirname, "../dist/client");
    app.use(express.static(clientDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      configFile: path.resolve(__dirname, "../vite.config.ts"),
      server: { middlewareMode: true },
      appType: "spa",
      root: path.resolve(__dirname, "../client"),
    });
    app.use(vite.middlewares);
  }

  try {
    await runSeed();
  } catch (err) {
    console.error("[seed] failed", err);
  }
  startHeartbeat();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

start();
