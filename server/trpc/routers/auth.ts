import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { db } from "../../db";
import { users } from "../../db/schema";
import { verifyPassword, signSessionToken, setSessionCookie, clearSessionCookie } from "../../lib/auth";

export const authRouter = router({
  loginWithPassword: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "邮箱或密码错误" });
      }

      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "邮箱或密码错误" });
      }

      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      const token = await signSessionToken(user.id);
      setSessionCookie(ctx.res, token);

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clubId: user.clubId,
        },
      };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    clearSessionCookie(ctx.res);
    return { success: true };
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    return {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
      clubId: ctx.user.clubId,
    };
  }),
});
