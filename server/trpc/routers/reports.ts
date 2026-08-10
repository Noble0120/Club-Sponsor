import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { router, protectedProcedure, adminProcedure, publicProcedure } from "../trpc";
import { db } from "../../db";
import { assets, companies, deliveries, matches, reportShareTokens, reports, users } from "../../db/schema";
import { invokeLLM } from "../../lib/llm";

async function assertCompanyInClub(companyId: number, clubId: number) {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.clubId, clubId)))
    .limit(1);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "赞助商不存在" });
  return company;
}

async function buildCompanyPrompt(companyId: number, clubId: number) {
  const company = await assertCompanyInClub(companyId, clubId);
  const companyAssets = await db.select().from(assets).where(eq(assets.companyId, companyId));
  const assetIds = companyAssets.map((a) => a.id);
  const assetDeliveries =
    assetIds.length > 0 ? await db.select().from(deliveries).where(inArray(deliveries.assetId, assetIds)) : [];
  const matchIds = [...new Set(assetDeliveries.map((d) => d.matchId).filter((id): id is number => id != null))];
  const matchRows = matchIds.length > 0 ? await db.select().from(matches).where(inArray(matches.id, matchIds)) : [];

  const delivered = assetDeliveries.filter((d) => d.status === "delivered");
  const issues = assetDeliveries.filter((d) => d.status === "issue");
  const unscheduled = assetDeliveries.filter((d) => d.status === "unscheduled");

  const assetsSection = companyAssets
    .map((asset) => {
      const ds = assetDeliveries.filter((d) => d.assetId === asset.id);
      const doneCount = ds.filter((d) => d.status === "delivered").length;
      return `- ${asset.name}（${asset.category || "未分类"}${asset.targetCount ? `，目标${asset.targetCount}${asset.countUnit ?? ""}` : ""}）：已完成 ${doneCount}/${ds.length}`;
    })
    .join("\n");

  const detailSection = assetDeliveries
    .map((d) => {
      const asset = companyAssets.find((a) => a.id === d.assetId);
      const match = d.matchId ? matchRows.find((m) => m.id === d.matchId) : null;
      const when = match
        ? `第${match.round}轮 vs ${match.opponent}（${match.matchDate.toISOString().slice(0, 10)}）`
        : d.scheduledDate
          ? d.scheduledDate.toISOString().slice(0, 10)
          : "未排期";
      return `- ${asset?.name ?? "未知资产"} | ${when} | 状态：${d.status}${d.note ? `｜备注：${d.note}` : ""}`;
    })
    .join("\n");

  return `你是一名专业的体育赞助商权益履约分析师。请根据以下数据，为赞助商生成一份详细的权益履约报告。

## 赞助商基本信息
- 名称：${company.name}
- 层级：${company.tier}
- 备注：${company.notes ?? "无"}

## 资产（权益）列表（共${companyAssets.length}项）
${assetsSection}

## 履约数据统计
- 交付总数：${assetDeliveries.length}
- 已完成：${delivered.length}
- 存在问题：${issues.length}
- 未排期：${unscheduled.length}

## 各交付明细
${detailSection}

请生成一份专业的权益履约报告，包含：
1. 执行摘要
2. 数据统计（表格）
3. 权益履约分析（逐类分析）
4. 问题与风险
5. 改进建议
6. 总体评价
报告使用 Markdown 格式，语言专业、客观。`;
}

async function buildSeasonPrompt(clubId: number) {
  const clubCompanies = await db
    .select()
    .from(companies)
    .where(and(eq(companies.clubId, clubId), eq(companies.stage, "signed")));
  const companyIds = clubCompanies.map((c) => c.id);
  const clubAssets =
    companyIds.length > 0 ? await db.select().from(assets).where(inArray(assets.companyId, companyIds)) : [];
  const assetIds = clubAssets.map((a) => a.id);
  const allDeliveries =
    assetIds.length > 0 ? await db.select().from(deliveries).where(inArray(deliveries.assetId, assetIds)) : [];

  const summaryLines = clubCompanies
    .map((company) => {
      const companyAssetIds = clubAssets.filter((a) => a.companyId === company.id).map((a) => a.id);
      const ds = allDeliveries.filter((d) => companyAssetIds.includes(d.assetId));
      const completed = ds.filter((d) => d.status === "delivered").length;
      const issues = ds.filter((d) => d.status === "issue").length;
      return `| ${company.name} | ${company.tier} | ${ds.length} | ${completed} | ${issues} |`;
    })
    .join("\n");

  return `你是一名专业的体育赞助商权益履约分析师。请根据以下数据，生成本赛季全体赞助商权益履约总结报告。

## 赛季概况
- 赞助商数量：${clubCompanies.length}家

## 各赞助商履约汇总
| 赞助商 | 层级 | 交付总数 | 已完成 | 存在问题 |
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
  byCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertCompanyInClub(input.companyId, ctx.user.clubId!);
      return db
        .select()
        .from(reports)
        .where(and(eq(reports.type, "company"), eq(reports.companyId, input.companyId)))
        .orderBy(desc(reports.createdAt));
    }),

  season: protectedProcedure.query(async ({ ctx }) => {
    const clubUsers = await db.select().from(users).where(eq(users.clubId, ctx.user.clubId!));
    const clubUserIds = clubUsers.map((u) => u.id);
    if (clubUserIds.length === 0) return [];
    return db
      .select()
      .from(reports)
      .where(and(eq(reports.type, "season"), inArray(reports.generatedBy, clubUserIds)))
      .orderBy(desc(reports.createdAt));
  }),

  generateCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const prompt = await buildCompanyPrompt(input.companyId, ctx.user.clubId!);
      const content = await invokeLLM(prompt);
      const [result] = await db.insert(reports).values({
        type: "company",
        companyId: input.companyId,
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
        companyId: z.number(),
        reportId: z.number().optional(),
        expiresInDays: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCompanyInClub(input.companyId, ctx.user.clubId!);
      const token = nanoid(32);
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;
      await db.insert(reportShareTokens).values({
        token,
        companyId: input.companyId,
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
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertCompanyInClub(input.companyId, ctx.user.clubId!);
      return db
        .select()
        .from(reportShareTokens)
        .where(eq(reportShareTokens.companyId, input.companyId))
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
      await assertCompanyInClub(link.companyId, ctx.user.clubId!);
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

    const [company] = await db.select().from(companies).where(eq(companies.id, link.companyId)).limit(1);
    if (!company) throw new TRPCError({ code: "NOT_FOUND" });

    const companyAssets = await db.select().from(assets).where(eq(assets.companyId, company.id));
    const assetIds = companyAssets.map((a) => a.id);
    const assetDeliveries =
      assetIds.length > 0 ? await db.select().from(deliveries).where(inArray(deliveries.assetId, assetIds)) : [];
    const matchIds = [...new Set(assetDeliveries.map((d) => d.matchId).filter((id): id is number => id != null))];
    const matchRows = matchIds.length > 0 ? await db.select().from(matches).where(inArray(matches.id, matchIds)) : [];

    let report = null;
    if (link.reportId) {
      const [r] = await db.select().from(reports).where(eq(reports.id, link.reportId)).limit(1);
      report = r ?? null;
    }

    return {
      company,
      report,
      generatedAt: link.createdAt,
      assets: companyAssets.map((asset) => ({
        asset,
        deliveries: assetDeliveries
          .filter((d) => d.assetId === asset.id)
          .map((delivery) => ({
            delivery,
            match: delivery.matchId ? (matchRows.find((m) => m.id === delivery.matchId) ?? null) : null,
          })),
      })),
    };
  }),
});
