import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "../../db";
import { deliveryTasks, deliveries, assets, companies, matches, taskStatusEnum } from "../../db/schema";

const taskStatusSchema = z.enum(taskStatusEnum);

async function assertClubOwnsTask(taskId: number, clubId: number) {
  const [task] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, taskId)).limit(1);
  if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
  const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, task.deliveryId)).limit(1);
  if (!delivery) throw new TRPCError({ code: "NOT_FOUND" });
  const [asset] = await db.select().from(assets).where(eq(assets.id, delivery.assetId)).limit(1);
  if (!asset) throw new TRPCError({ code: "NOT_FOUND" });
  const [company] = await db.select().from(companies).where(eq(companies.id, asset.companyId)).limit(1);
  if (!company || company.clubId !== clubId) throw new TRPCError({ code: "FORBIDDEN" });
  return { task, delivery, asset, company };
}

export const tasksRouter = router({
  // Every task in the club, joined with its delivery/asset/company/match context — the Kanban
  // board groups these by status (and, in the UI, by company) client-side.
  board: protectedProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId;
    if (!clubId) return [];
    const clubCompanies = await db.select().from(companies).where(eq(companies.clubId, clubId));
    const companyIds = clubCompanies.map((c) => c.id);
    if (companyIds.length === 0) return [];

    const clubAssets = await db.select().from(assets).where(inArray(assets.companyId, companyIds));
    const assetIds = clubAssets.map((a) => a.id);
    if (assetIds.length === 0) return [];

    const clubDeliveries = await db.select().from(deliveries).where(inArray(deliveries.assetId, assetIds));
    const deliveryIds = clubDeliveries.map((d) => d.id);
    if (deliveryIds.length === 0) return [];

    const clubTasks = await db.select().from(deliveryTasks).where(inArray(deliveryTasks.deliveryId, deliveryIds));

    const matchIds = [...new Set(clubDeliveries.map((d) => d.matchId).filter((id): id is number => id != null))];
    const matchRows = matchIds.length > 0 ? await db.select().from(matches).where(inArray(matches.id, matchIds)) : [];

    return clubTasks.map((task) => {
      const delivery = clubDeliveries.find((d) => d.id === task.deliveryId)!;
      const asset = clubAssets.find((a) => a.id === delivery.assetId)!;
      const company = clubCompanies.find((c) => c.id === asset.companyId)!;
      const match = delivery.matchId ? (matchRows.find((m) => m.id === delivery.matchId) ?? null) : null;
      return { task, delivery, asset, company, match };
    });
  }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: taskStatusSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertClubOwnsTask(input.id, ctx.user.clubId!);
      await db
        .update(deliveryTasks)
        .set({
          status: input.status,
          completedAt: input.status === "done" ? new Date() : null,
          completedBy: input.status === "done" ? ctx.user.id : null,
        })
        .where(eq(deliveryTasks.id, input.id));
      const [task] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, input.id)).limit(1);
      return task;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        note: z.string().optional(),
        fileUrls: z.array(z.string()).optional(),
        assigneeId: z.number().optional(),
        dueDate: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, fileUrls, ...rest } = input;
      await assertClubOwnsTask(id, ctx.user.clubId!);
      await db
        .update(deliveryTasks)
        .set({ ...rest, fileUrls: fileUrls ? JSON.stringify(fileUrls) : undefined })
        .where(eq(deliveryTasks.id, id));
      const [task] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, id)).limit(1);
      return task;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertClubOwnsTask(input.id, ctx.user.clubId!);
      await db.delete(deliveryTasks).where(eq(deliveryTasks.id, input.id));
      return { success: true };
    }),
});
