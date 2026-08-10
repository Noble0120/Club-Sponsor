import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./llm";

const MAX_CONTRACT_TEXT_LENGTH = 24000;

export const extractedAssetSchema = z.object({
  name: z.string().min(1),
  category: z.string().nullable().optional(),
  targetCount: z.number().nullable().optional(),
  countUnit: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  attachmentRequirement: z.string().nullable().optional(),
  requiresApproval: z.boolean().nullable().optional(),
});

export type ExtractedAsset = z.infer<typeof extractedAssetSchema>;

function buildExtractionPrompt(companyName: string, contractText: string, hints: { name: string; category?: string }[]) {
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

  return `你是一名专业的体育赞助合同分析师。请仔细阅读以下赞助合同原文，为赞助商"${companyName}"提取出所有权益条款，拆分成结构化的资产（Asset）列表。

${hintsSection}## 合同原文
${truncated}

请提取合同中约定的每一项赞助权益，作为一个独立资产条目。资产不需要指定"履约模式"，只需要用 scope 字段自然语言描述这项权益应该在什么范围内交付（系统会自动据此排期），例如："全部主场比赛"、"每个主场"、"全年持续展示"、"仅需完成一次"、"3月至11月每月一次"。

只返回一个 JSON 数组，不要包含任何其他文字、说明或 Markdown 代码块标记。数组中每个对象包含以下字段：
{
  "name": "资产/权益名称",
  "category": "权益分类，如媒体曝光、票务接待等，没有明确分类则留空字符串",
  "targetCount": 数字或 null（该权益全季总共需要交付的数量，例如4条视频、15场展示；如果是逐场比赛类型可以留空，系统会按比赛场次数自动计算）,
  "countUnit": "单位，如条/场/次，没有则为 null",
  "scope": "适用范围/交付节奏的自然语言描述",
  "startDate": "YYYY-MM-DD 或 null",
  "endDate": "YYYY-MM-DD 或 null",
  "attachmentRequirement": "验收所需附件要求说明，没有则留空字符串",
  "requiresApproval": true 或 false（涉及金额较大或需要专人审核的建议为 true）
}`;
}

function parseExtractionResponse(raw: string): ExtractedAsset[] {
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

  const result = z.array(extractedAssetSchema).safeParse(parsed);
  if (!result.success) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 返回格式不符合预期，请重试" });
  }
  return result.data;
}

export async function extractAssetsFromContract(
  companyName: string,
  contractText: string,
  hints: { name: string; category?: string }[],
): Promise<ExtractedAsset[]> {
  const prompt = buildExtractionPrompt(companyName, contractText, hints);
  const raw = await invokeLLM(prompt);
  return parseExtractionResponse(raw);
}
