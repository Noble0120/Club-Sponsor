import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { router, protectedProcedure, adminProcedure, publicProcedure } from "../trpc";
import { db } from "../../db";
import {
  acceptanceRecords,
  benefitCheckItems,
  benefitItems,
  matches,
  reportShareTokens,
  reports,
  sponsors,
  users,
} from "../../db/schema";
import { invokeLLM } from "../../lib/llm";

const TIER_LABELS: Record<string, string> = {
  title: "冠名赞助商",
  exclusive_premier: "独家首席合作伙伴",
  exclusive_premium: "独家尊享合作伙伴",
  gold: "黄金赞助商",
  official: "官方合作伙伴",
  supplier: "官方指定供应商",
};

const FULFILLED_LABELS: Record<string, string> = {
  yes: "已履约",
  no: "未履约",
  partial: "部分履约",
  na: "不适用",
};

async function assertSponsorInClub(sponsorId: number, clubId: number) {
  const [sponsor] = await db
    .select()
    .from(sponsors)
    .where(and(eq(sponsors.id, sponsorId), eq(sponsors.clubId, clubId)))
    .limit(1);
  if (!sponsor) throw new TRPCError({ code: "NOT_FOUND", message: "赞助商不存在" });
  return sponsor;
}

async function buildSponsorPrompt(sponsorId: number, clubId: number) {
  const sponsor = await assertSponsorInClub(sponsorId, clubId);
  const items = await db.select().from(benefitItems).where(eq(benefitItems.sponsorId, sponsorId));
  const clubMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.clubId, clubId))
    .orderBy(asc(matches.round));
  const records = await db
    .select()
    .from(acceptanceRecords)
    .where(eq(acceptanceRecords.sponsorId, sponsorId));
  const recordIds = records.map((r) => r.id);
  const checkItems =
    recordIds.length > 0
      ? await db.select().from(benefitCheckItems).where(inArray(benefitCheckItems.recordId, recordIds))
      : [];

  const completedRecords = records.filter((r) => r.status === "completed");
  const issueRecords = records.filter((r) => r.status === "issue");
  const ratings = records.filter((r) => r.overallRating != null).map((r) => r.overallRating!);
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "无";

  const itemsSection = items
    .map((i) => `- ${i.name}（${i.itemType === "per_match" ? "场次型" : "全季型"}）`)
    .join("\n");

  const detailSection = clubMatches
    .map((m) => {
      const record = records.find((r) => r.matchId === m.id);
      if (!record) return `第${m.round}轮 vs ${m.opponent}（${m.isHome ? "主场" : "客场"}，${m.matchDate.toISOString().slice(0, 10)}）\n  未填写验收记录`;
      const recordCheckItems = checkItems.filter((c) => c.recordId === record.id);
      const itemLines = recordCheckItems
        .map((c) => {
          const benefitItem = items.find((bi) => bi.id === c.benefitItemId);
          const benefitName = benefitItem?.name ?? "未知权益";
          return `  - ${benefitName}: ${FULFILLED_LABELS[c.fulfilled]}${c.note ? `（${c.note}）` : ""}`;
        })
        .join("\n");
      return `第${m.round}轮 vs ${m.opponent}（${m.isHome ? "主场" : "客场"}，${m.matchDate.toISOString().slice(0, 10)}）\n  整体状态：${record.status}\n  评分：${record.overallRating ?? "无"}\n  备注：${record.summary ?? "无"}\n${itemLines}`;
    })
    .join("\n\n");

  return `你是一名专业的体育赞助商权益验收分析师。请根据以下数据，为赞助商生成一份详细的权益验收报告。

## 赞助商基本信息
- 赞助商名称：${sponsor.name}
- 赞助层级：${TIER_LABELS[sponsor.tier]}
- 备注：${sponsor.notes ?? "无"}

## 权益条目列表（共${items.length}条）
${itemsSection}

## 验收数据统计
- 总场次：${clubMatches.length}场
- 已填写验收记录：${records.length}场
- 已完成验收：${completedRecords.length}场
- 存在问题：${issueRecords.length}场
- 平均评分：${avgRating}分

## 各场次验收详情
${detailSection}

请生成一份专业的权益验收报告，包含：
1. 执行摘要
2. 数据统计（表格）
3. 权益履约分析（逐类分析）
4. 问题与风险
5. 改进建议
6. 总体评价
报告使用 Markdown 格式，语言专业、客观。`;
}

async function buildSeasonPrompt(clubId: number) {
  const clubSponsors = await db.select().from(sponsors).where(eq(sponsors.clubId, clubId));
  const clubMatches = await db.select().from(matches).where(eq(matches.clubId, clubId));
  const matchIds = clubMatches.map((m) => m.id);
  const records =
    matchIds.length > 0
      ? await db.select().from(acceptanceRecords).where(inArray(acceptanceRecords.matchId, matchIds))
      : [];

  const summaryLines = clubSponsors
    .map((sponsor) => {
      const sponsorRecords = records.filter((r) => r.sponsorId === sponsor.id);
      const completed = sponsorRecords.filter((r) => r.status === "completed").length;
      const issues = sponsorRecords.filter((r) => r.status === "issue").length;
      return `| ${sponsor.name} | ${TIER_LABELS[sponsor.tier]} | ${sponsorRecords.length}/${clubMatches.length} | ${completed} | ${issues} |`;
    })
    .join("\n");

  return `你是一名专业的体育赞助商权益验收分析师。请根据以下数据，生成本赛季全体赞助商权益验收总结报告。

## 赛季概况
- 总场次：${clubMatches.length}场
- 赞助商数量：${clubSponsors.length}家

## 各赞助商履约汇总
| 赞助商 | 层级 | 已验收/总场次 | 已完成 | 存在问题 |
|---|---|---|---|---|
${summaryLines}

请生成一份专业的赛季总结报告，包含：
1. 赛季概述
2. 各赞助商履约汇总表格
3. 优秀案例
4. 问题汇总
5. 改进建议
报告使用 Markdown 格式，语言专业、客观。`;
}

export const reportsRouter = router({
  bySponsor: protectedProcedure
    .input(z.object({ sponsorId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);
      return db
        .select()
        .from(reports)
        .where(and(eq(reports.type, "sponsor"), eq(reports.sponsorId, input.sponsorId)))
        .orderBy(desc(reports.createdAt));
    }),

  season: protectedProcedure.query(async ({ ctx }) => {
    // Season reports have no clubId column, so scope them by which club their generatingBy user belongs to.
    const clubUsers = await db.select().from(users).where(eq(users.clubId, ctx.user.clubId!));
    const clubUserIds = clubUsers.map((u) => u.id);
    if (clubUserIds.length === 0) return [];
    return db
      .select()
      .from(reports)
      .where(and(eq(reports.type, "season"), inArray(reports.generatedBy, clubUserIds)))
      .orderBy(desc(reports.createdAt));
  }),

  generateSponsor: protectedProcedure
    .input(z.object({ sponsorId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const prompt = await buildSponsorPrompt(input.sponsorId, ctx.user.clubId!);
      const content = await invokeLLM(prompt);
      const [result] = await db.insert(reports).values({
        type: "sponsor",
        sponsorId: input.sponsorId,
        content,
        generatedBy: ctx.user.id,
      });
      const [report] = await db.select().from(reports).where(eq(reports.id, result.insertId)).limit(1);
      return report;
    }),

  generateSeason: protectedProcedure.mutation(async ({ ctx }) => {
    const prompt = await buildSeasonPrompt(ctx.user.clubId!);
    const content = await invokeLLM(prompt);
    const [result] = await db.insert(reports).values({
      type: "season",
      content,
      generatedBy: ctx.user.id,
    });
    const [report] = await db.select().from(reports).where(eq(reports.id, result.insertId)).limit(1);
    return report;
  }),

  createShareLink: adminProcedure
    .input(
      z.object({
        sponsorId: z.number(),
        reportId: z.number().optional(),
        expiresInDays: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);
      const token = nanoid(32);
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;
      await db.insert(reportShareTokens).values({
        token,
        sponsorId: input.sponsorId,
        reportId: input.reportId,
        createdBy: ctx.user.id,
        expiresAt,
      });
      const [link] = await db
        .select()
        .from(reportShareTokens)
        .where(eq(reportShareTokens.token, token))
        .limit(1);
      return link;
    }),

  listShareLinks: adminProcedure
    .input(z.object({ sponsorId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);
      return db
        .select()
        .from(reportShareTokens)
        .where(eq(reportShareTokens.sponsorId, input.sponsorId))
        .orderBy(desc(reportShareTokens.createdAt));
    }),

  deleteShareLink: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [link] = await db
        .select()
        .from(reportShareTokens)
        .where(eq(reportShareTokens.id, input.id))
        .limit(1);
      if (!link) throw new TRPCError({ code: "NOT_FOUND" });
      await assertSponsorInClub(link.sponsorId, ctx.user.clubId!);
      await db.delete(reportShareTokens).where(eq(reportShareTokens.id, input.id));
      return { success: true };
    }),

  publicView: publicProcedure.input(z.object({ token: z.string() })).query(async ({ input }) => {
    const [link] = await db
      .select()
      .from(reportShareTokens)
      .where(eq(reportShareTokens.token, input.token))
      .limit(1);
    if (!link) throw new TRPCError({ code: "FORBIDDEN", message: "链接不存在" });
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      throw new TRPCError({ code: "FORBIDDEN", message: "链接已过期" });
    }

    const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.id, link.sponsorId)).limit(1);
    if (!sponsor) throw new TRPCError({ code: "NOT_FOUND" });

    const items = await db.select().from(benefitItems).where(eq(benefitItems.sponsorId, sponsor.id));
    const clubMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.clubId, sponsor.clubId))
      .orderBy(asc(matches.round));
    const records = await db
      .select()
      .from(acceptanceRecords)
      .where(eq(acceptanceRecords.sponsorId, sponsor.id));
    const recordIds = records.map((r) => r.id);
    const checkItems =
      recordIds.length > 0
        ? await db.select().from(benefitCheckItems).where(inArray(benefitCheckItems.recordId, recordIds))
        : [];

    let report = null;
    if (link.reportId) {
      const [r] = await db.select().from(reports).where(eq(reports.id, link.reportId)).limit(1);
      report = r ?? null;
    }

    return {
      sponsor,
      report,
      generatedAt: link.createdAt,
      benefitItems: items,
      matches: clubMatches.map((match) => ({
        match,
        record: records.find((r) => r.matchId === match.id) ?? null,
        checkItems: checkItems.filter((c) => records.find((r) => r.matchId === match.id)?.id === c.recordId),
      })),
    };
  }),
});
