import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import { deliveries, assets, companies, matches } from "../../db/schema";

async function getDeliveryWithContext(deliveryId: number) {
  const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, deliveryId)).limit(1);
  if (!delivery) throw new TRPCError({ code: "NOT_FOUND", message: "交付记录不存在" });
  const [asset] = await db.select().from(assets).where(eq(assets.id, delivery.assetId)).limit(1);
  if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "关联资产不存在" });
  const [company] = await db.select().from(companies).where(eq(companies.id, asset.companyId)).limit(1);
  return { delivery, asset, company };
}

async function assertClubOwnsDelivery(deliveryId: number, clubId: number) {
  const ctx = await getDeliveryWithContext(deliveryId);
  if (!ctx.company || ctx.company.clubId !== clubId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return ctx;
}

export const deliveriesRouter = router({
  // Scheduled deliveries with an effective date in the future, across every company in the
  // club — powers the Home "Upcoming Deliveries" table.
  upcoming: protectedProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId;
    if (!clubId) return [];
    const clubCompanies = await db.select().from(companies).where(eq(companies.clubId, clubId));
    const companyIds = clubCompanies.map((c) => c.id);
    if (companyIds.length === 0) return [];

    const clubAssets = await db.select().from(assets).where(inArray(assets.companyId, companyIds));
    const assetIds = clubAssets.map((a) => a.id);
    if (assetIds.length === 0) return [];

    const rows = await db
      .select()
      .from(deliveries)
      .where(and(inArray(deliveries.assetId, assetIds), eq(deliveries.status, "scheduled")));

    const matchIds = [...new Set(rows.map((r) => r.matchId).filter((id): id is number => id != null))];
    const matchRows = matchIds.length > 0 ? await db.select().from(matches).where(inArray(matches.id, matchIds)) : [];

    const now = Date.now();
    return rows
      .map((delivery) => {
        const asset = clubAssets.find((a) => a.id === delivery.assetId)!;
        const company = clubCompanies.find((c) => c.id === asset.companyId)!;
        const match = delivery.matchId ? (matchRows.find((m) => m.id === delivery.matchId) ?? null) : null;
        const effectiveDate = match?.matchDate ?? delivery.scheduledDate ?? null;
        return { delivery, asset, company, match, effectiveDate };
      })
      .filter((row) => row.effectiveDate && row.effectiveDate.getTime() >= now)
      .sort((a, b) => a.effectiveDate!.getTime() - b.effectiveDate!.getTime())
      .slice(0, 30);
  }),

  // Deliveries that still need to be scheduled to a match/date — powers the Home
  // "Unscheduled Rights" table and is what the AI-generated per-unit delivery slots feed into.
  unscheduled: protectedProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId;
    if (!clubId) return [];
    const clubCompanies = await db.select().from(companies).where(eq(companies.clubId, clubId));
    const companyIds = clubCompanies.map((c) => c.id);
    if (companyIds.length === 0) return [];

    const clubAssets = await db.select().from(assets).where(inArray(assets.companyId, companyIds));
    const assetIds = clubAssets.map((a) => a.id);
    if (assetIds.length === 0) return [];

    const rows = await db
      .select()
      .from(deliveries)
      .where(and(inArray(deliveries.assetId, assetIds), eq(deliveries.status, "unscheduled")));

    return rows.map((delivery) => {
      const asset = clubAssets.find((a) => a.id === delivery.assetId)!;
      const company = clubCompanies.find((c) => c.id === asset.companyId)!;
      return { delivery, asset, company };
    });
  }),

  schedule: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        matchId: z.number().optional(),
        scheduledDate: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertClubOwnsDelivery(input.id, ctx.user.clubId!);
      if (!input.matchId && !input.scheduledDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请选择比赛或填写日期" });
      }
      await db
        .update(deliveries)
        .set({ matchId: input.matchId, scheduledDate: input.scheduledDate, status: "scheduled" })
        .where(eq(deliveries.id, input.id));
      const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, input.id)).limit(1);
      return delivery;
    }),

  markDelivered: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        completedCount: z.number().optional(),
        note: z.string().optional(),
        attachmentUrls: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { asset } = await assertClubOwnsDelivery(input.id, ctx.user.clubId!);
      const requiresApproval = asset?.requiresApproval ?? false;
      await db
        .update(deliveries)
        .set({
          status: "delivered",
          completedCount: input.completedCount,
          note: input.note,
          attachmentUrls: input.attachmentUrls ? JSON.stringify(input.attachmentUrls) : undefined,
          reviewStatus: requiresApproval ? "pending" : "approved",
          reviewedBy: requiresApproval ? null : ctx.user.id,
          reviewedAt: requiresApproval ? null : new Date(),
        })
        .where(eq(deliveries.id, input.id));
      const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, input.id)).limit(1);
      return delivery;
    }),

  markIssue: protectedProcedure
    .input(z.object({ id: z.number(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertClubOwnsDelivery(input.id, ctx.user.clubId!);
      await db.update(deliveries).set({ status: "issue", note: input.note }).where(eq(deliveries.id, input.id));
      const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, input.id)).limit(1);
      return delivery;
    }),

  pendingReviews: adminProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId!;
    const clubCompanies = await db.select().from(companies).where(eq(companies.clubId, clubId));
    const companyIds = clubCompanies.map((c) => c.id);
    if (companyIds.length === 0) return [];

    const clubAssets = await db.select().from(assets).where(inArray(assets.companyId, companyIds));
    const assetIds = clubAssets.map((a) => a.id);
    if (assetIds.length === 0) return [];

    const pending = await db
      .select()
      .from(deliveries)
      .where(and(inArray(deliveries.assetId, assetIds), eq(deliveries.reviewStatus, "pending")));

    const matchIds = [...new Set(pending.map((d) => d.matchId).filter((id): id is number => id != null))];
    const matchRows = matchIds.length > 0 ? await db.select().from(matches).where(inArray(matches.id, matchIds)) : [];

    return pending.map((delivery) => {
      const asset = clubAssets.find((a) => a.id === delivery.assetId)!;
      const company = clubCompanies.find((c) => c.id === asset.companyId)!;
      const match = delivery.matchId ? (matchRows.find((m) => m.id === delivery.matchId) ?? null) : null;
      return { delivery, asset, company, match };
    });
  }),

  review: adminProcedure
    .input(z.object({ id: z.number(), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertClubOwnsDelivery(input.id, ctx.user.clubId!);
      await db
        .update(deliveries)
        .set({
          reviewStatus: input.approve ? "approved" : "rejected",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(deliveries.id, input.id));
      const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, input.id)).limit(1);
      return delivery;
    }),
});
