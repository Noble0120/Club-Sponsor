import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { getSessionTokenFromRequest, verifySessionToken } from "../lib/auth";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const token = getSessionTokenFromRequest(req);
  let user: typeof users.$inferSelect | null = null;

  if (token) {
    const payload = await verifySessionToken(token);
    if (payload) {
      const [found] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      user = found ?? null;
    }
  }

  return { req, res, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});
