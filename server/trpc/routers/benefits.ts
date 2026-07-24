import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import {
  benefitItems,
  benefitCheckItems,
  acceptanceRecords,
  sponsors,
  sponsorContracts,
  matches,
  fulfillmentModeEnum,
} from "../../db/schema";
import { computeBenefitItemProgress } from "../../lib/benefitProgress";
import { invokeLLM } from "../../lib/llm";

const fulfillmentModeSchema = z.enum(fulfillmentModeEnum);

const MAX_CONTRACT_TEXT_LENGTH = 24000;

const extractedItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().nullable().optional(),
  fulfillmentMode: fulfillmentModeSchema,
  targetCount: z.number().nullable().optional(),
  countUnit: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
  attachmentRequirement: z.string().nullable().optional(),
  requiresApproval: z.boolean().nullable().optional(),
  contractNote: z.string().nullable().optional(),
});

function buildExtractionPrompt(
  sponsorName: string,
  contractText: string,
  hints: { name: string; category?: string }[],
) {
  const truncated =
    contractText.length > MAX_CONTRACT_TEXT_LENGTH
      ? `${contractText.slice(0, MAX_CONTRACT_TEXT_LENGTH)}\n...(内容过长，已截断)`
      : contractText;

  const hintsSection =
    hints.length > 0
      ? `## 已知权益名称清单（来自Excel，可能不完整或不够准确，请结合合同原文校对、修正、补充）\n${hints
          .map((h) => `- ${h.name}${h.category ? `（${h.category}）` : ""}`)
          .join("\n")}\n`
      : "";

  return `你是一名专业的体育赞助合同分析师。请仔细阅读以下赞助合同原文，为赞助商"${sponsorName}"提取出所有权益条款，拆分成结构化的权益条目列表。

${hintsSection}## 合同原文
${truncated}

请提取合同中约定的每一项赞助权益，判断其履约验收方式，归类为以下6种履约模式之一：
- QUANTITY：全季累计完成一定数量（如制作N条视频、投放N次广告）
- MATCH：需要逐场比赛单独验收（如每场主场比赛都要展示）
- ROUND：按联赛轮次逐轮验收
- EVENT：全季累计完成一定次数的活动（如举办N次球迷活动）
- ONE_TIME：只需完成一次即可（如授权书签署、形象使用许可）
- CONTINUOUS：需要在某个时间段内持续满足（如广告牌常年展示）

只返回一个 JSON 数组，不要包含任何其他文字、说明或 Markdown 代码块标记。数组中每个对象包含以下字段：
{
  "name": "权益名称",
  "category": "权益分类，如媒体曝光、票务接待等，没有明确分类则留空字符串",
  "fulfillmentMode": "QUANTITY|MATCH|ROUND|EVENT|ONE_TIME|CONTINUOUS 之一",
  "targetCount": 数字或 null,
  "countUnit": "单位，如条/场/次，没有则为 null",
  "startDate": "YYYY-MM-DD 或 null",
  "endDate": "YYYY-MM-DD 或 null",
  "scope": "适用范围说明，没有明确写出可留空字符串",
  "attachmentRequirement": "验收所需附件要求说明，没有则留空字符串",
  "requiresApproval": true 或 false（涉及金额较大或需要专人审核的建议为 true）,
  "contractNote": "对应的合同原文摘录，方便人工核对"
}`;
}

function parseExtractionResponse(raw: string) {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 返回内容无法解析，请重试" });
  }

  const result = z.array(extractedItemSchema).safeParse(parsed);
  if (!result.success) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 返回格式不符合预期，请重试" });
  }
  return result.data;
}

async function assertSponsorInClub(sponsorId: number, clubId: number) {
  const [sponsor] = await db
    .select()
    .from(sponsors)
    .where(and(eq(sponsors.id, sponsorId), eq(sponsors.clubId, clubId)))
    .limit(1);
  if (!sponsor) {
    throw new TRPCError({ code: "NOT_FOUND", message: "赞助商不存在" });
  }
  return sponsor;
}

async function getBenefitItemWithSponsor(benefitItemId: number) {
  const [item] = await db.select().from(benefitItems).where(eq(benefitItems.id, benefitItemId)).limit(1);
  if (!item) {
    throw new TRPCError({ code: "NOT_FOUND", message: "权益条目不存在" });
  }
  const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.id, item.sponsorId)).limit(1);
  return { item, sponsor };
}

const benefitItemFields = {
  code: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  fulfillmentMode: fulfillmentModeSchema.default("MATCH"),
  targetCount: z.number().optional(),
  countUnit: z.string().optional(),
  category: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  scope: z.string().optional(),
  attachmentRequirement: z.string().optional(),
  requiresApproval: z.boolean().optional(),
  assigneeId: z.number().optional(),
  contractNote: z.string().optional(),
  sortOrder: z.number().optional(),
};

export const benefitsRouter = router({
  bySponsor: protectedProcedure
    .input(z.object({ sponsorId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);
      return db
        .select()
        .from(benefitItems)
        .where(eq(benefitItems.sponsorId, input.sponsorId))
        .orderBy(asc(benefitItems.sortOrder));
    }),

  create: adminProcedure
    .input(z.object({ sponsorId: z.number(), ...benefitItemFields }))
    .mutation(async ({ ctx, input }) => {
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);
      const [result] = await db.insert(benefitItems).values(input);
      const [item] = await db.select().from(benefitItems).where(eq(benefitItems.id, result.insertId)).limit(1);
      return item;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        code: z.string().optional(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        fulfillmentMode: fulfillmentModeSchema.optional(),
        targetCount: z.number().optional(),
        countUnit: z.string().optional(),
        category: z.string().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        scope: z.string().optional(),
        attachmentRequirement: z.string().optional(),
        requiresApproval: z.boolean().optional(),
        assigneeId: z.number().optional(),
        contractNote: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const { sponsor } = await getBenefitItemWithSponsor(id);
      if (!sponsor || sponsor.clubId !== ctx.user.clubId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.update(benefitItems).set(rest).where(eq(benefitItems.id, id));
      const [item] = await db.select().from(benefitItems).where(eq(benefitItems.id, id)).limit(1);
      return item;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { sponsor } = await getBenefitItemWithSponsor(input.id);
      if (!sponsor || sponsor.clubId !== ctx.user.clubId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.delete(benefitItems).where(eq(benefitItems.id, input.id));
      return { success: true };
    }),

  progressBySponsor: protectedProcedure
    .input(z.object({ sponsorId: z.number() }))
    .query(async ({ ctx, input }) => {
      const clubId = ctx.user.clubId!;
      await assertSponsorInClub(input.sponsorId, clubId);

      const items = await db
        .select()
        .from(benefitItems)
        .where(and(eq(benefitItems.sponsorId, input.sponsorId), eq(benefitItems.isActive, true)))
        .orderBy(asc(benefitItems.sortOrder));

      const clubMatches = await db.select().from(matches).where(eq(matches.clubId, clubId));
      const sponsorRecords = await db
        .select()
        .from(acceptanceRecords)
        .where(eq(acceptanceRecords.sponsorId, input.sponsorId));
      const recordIds = sponsorRecords.map((r) => r.id);
      const itemIds = items.map((i) => i.id);

      const checkItems =
        recordIds.length > 0 && itemIds.length > 0
          ? await db
              .select()
              .from(benefitCheckItems)
              .where(
                and(
                  inArray(benefitCheckItems.recordId, recordIds),
                  inArray(benefitCheckItems.benefitItemId, itemIds),
                ),
              )
          : [];

      const progress = items.map((item) =>
        computeBenefitItemProgress(
          item,
          clubMatches,
          sponsorRecords,
          checkItems.filter((c) => c.benefitItemId === item.id),
        ),
      );

      return progress;
    }),

  // Rows already parsed/extracted client-side (from a spreadsheet, or reviewed AI output from
  // extractFromContract). Sponsors are matched by name (case-insensitive) within the club and
  // auto-created if no match exists.
  importList: adminProcedure
    .input(
      z.array(
        z.object({
          sponsorName: z.string().min(1),
          code: z.string().optional(),
          name: z.string().min(1),
          category: z.string().optional(),
          fulfillmentMode: fulfillmentModeSchema,
          targetCount: z.number().optional(),
          countUnit: z.string().optional(),
          startDate: z.coerce.date().optional(),
          endDate: z.coerce.date().optional(),
          scope: z.string().optional(),
          attachmentRequirement: z.string().optional(),
          requiresApproval: z.boolean().optional(),
          contractNote: z.string().optional(),
        }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const clubId = ctx.user.clubId!;
      const clubSponsors = await db.select().from(sponsors).where(eq(sponsors.clubId, clubId));
      const sponsorsCreated: string[] = [];

      let created = 0;
      for (const row of input) {
        let sponsor = clubSponsors.find(
          (s) => s.name.trim().toLowerCase() === row.sponsorName.trim().toLowerCase(),
        );
        if (!sponsor) {
          const [result] = await db.insert(sponsors).values({
            clubId,
            name: row.sponsorName.trim(),
            tier: "待设置",
          });
          const [newSponsor] = await db.select().from(sponsors).where(eq(sponsors.id, result.insertId)).limit(1);
          sponsor = newSponsor;
          clubSponsors.push(sponsor);
          sponsorsCreated.push(sponsor.name);
        }

        await db.insert(benefitItems).values({
          sponsorId: sponsor.id,
          code: row.code,
          name: row.name,
          category: row.category || "",
          fulfillmentMode: row.fulfillmentMode,
          targetCount: row.targetCount,
          countUnit: row.countUnit,
          startDate: row.startDate,
          endDate: row.endDate,
          scope: row.scope,
          attachmentRequirement: row.attachmentRequirement,
          requiresApproval: row.requiresApproval,
          contractNote: row.contractNote,
        });
        created += 1;
      }

      return { created, sponsorsCreated };
    }),

  // Reads a previously-uploaded contract's cached extracted text, cross-references it against
  // any hints parsed from an Excel sheet, and asks the LLM to produce a structured, reviewable
  // list of benefit items. Nothing is written to the database here — the admin reviews the
  // result and confirms via importList.
  extractFromContract: adminProcedure
    .input(
      z.object({
        sponsorId: z.number(),
        contractId: z.number(),
        hints: z.array(z.object({ name: z.string(), category: z.string().optional() })).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sponsor = await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);

      const [contract] = await db
        .select()
        .from(sponsorContracts)
        .where(eq(sponsorContracts.id, input.contractId))
        .limit(1);
      if (!contract || contract.sponsorId !== input.sponsorId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "合同不存在" });
      }
      if (!contract.extractedText) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该合同未能提取出文本内容，请确认是文字版 PDF" });
      }

      const prompt = buildExtractionPrompt(sponsor.name, contract.extractedText, input.hints ?? []);
      const raw = await invokeLLM(prompt);
      return parseExtractionResponse(raw);
    }),

  pendingReviews: adminProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId!;
    const clubSponsors = await db.select().from(sponsors).where(eq(sponsors.clubId, clubId));
    const sponsorIds = clubSponsors.map((s) => s.id);
    if (sponsorIds.length === 0) return [];

    const items = await db.select().from(benefitItems).where(inArray(benefitItems.sponsorId, sponsorIds));
    const itemIds = items.map((i) => i.id);
    if (itemIds.length === 0) return [];

    const records = await db
      .select()
      .from(acceptanceRecords)
      .where(inArray(acceptanceRecords.sponsorId, sponsorIds));
    const recordIds = records.map((r) => r.id);
    if (recordIds.length === 0) return [];

    const pending = await db
      .select()
      .from(benefitCheckItems)
      .where(
        and(
          inArray(benefitCheckItems.recordId, recordIds),
          inArray(benefitCheckItems.benefitItemId, itemIds),
          eq(benefitCheckItems.reviewStatus, "pending"),
        ),
      );

    const matchIds = [...new Set(records.map((r) => r.matchId))];
    const matchRows = matchIds.length > 0 ? await db.select().from(matches).where(inArray(matches.id, matchIds)) : [];

    return pending.map((checkItem) => {
      const record = records.find((r) => r.id === checkItem.recordId)!;
      const benefitItem = items.find((i) => i.id === checkItem.benefitItemId)!;
      const sponsor = clubSponsors.find((s) => s.id === record.sponsorId)!;
      const match = matchRows.find((m) => m.id === record.matchId)!;
      return { checkItem, benefitItem, sponsor, match };
    });
  }),

  reviewCheckItem: adminProcedure
    .input(z.object({ checkItemId: z.number(), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [checkItem] = await db
        .select()
        .from(benefitCheckItems)
        .where(eq(benefitCheckItems.id, input.checkItemId))
        .limit(1);
      if (!checkItem) throw new TRPCError({ code: "NOT_FOUND" });

      const { sponsor } = await getBenefitItemWithSponsor(checkItem.benefitItemId);
      if (!sponsor || sponsor.clubId !== ctx.user.clubId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .update(benefitCheckItems)
        .set({
          reviewStatus: input.approve ? "approved" : "rejected",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(benefitCheckItems.id, input.checkItemId));

      const [updated] = await db
        .select()
        .from(benefitCheckItems)
        .where(eq(benefitCheckItems.id, input.checkItemId))
        .limit(1);
      return updated;
    }),
});
