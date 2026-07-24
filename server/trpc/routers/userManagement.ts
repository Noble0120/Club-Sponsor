import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../trpc";
import { db } from "../../db";
import { users } from "../../db/schema";
import { hashPassword } from "../../lib/auth";

export const userManagementRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return db.select().from(users).where(eq(users.clubId, ctx.user.clubId!));
  }),

  create: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1),
        password: z.string().min(6),
        role: z.enum(["user", "admin"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "该邮箱已被注册" });
      }

      const passwordHash = await hashPassword(input.password);
      const [result] = await db.insert(users).values({
        openId: `local:${input.email}`,
        name: input.name,
        email: input.email,
        loginMethod: "local",
        role: input.role,
        clubId: ctx.user.clubId,
        passwordHash,
      });
      const [user] = await db.select().from(users).where(eq(users.id, result.insertId)).limit(1);
      return user;
    }),

  resetPassword: adminProcedure
    .input(z.object({ userId: z.number(), newPassword: z.string().min(6) }))
    .mutation(async ({ ctx, input }) => {
      const passwordHash = await hashPassword(input.newPassword);
      await db
        .update(users)
        .set({ passwordHash })
        .where(and(eq(users.id, input.userId), eq(users.clubId, ctx.user.clubId!)));
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "不能删除自己" });
      }
      await db
        .delete(users)
        .where(and(eq(users.id, input.userId), eq(users.clubId, ctx.user.clubId!)));
      return { success: true };
    }),
});
