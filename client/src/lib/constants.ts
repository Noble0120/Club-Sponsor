// Sponsor tier and benefit category are free text so each club can define their own —
// colors are derived deterministically from the text instead of a fixed lookup table.
const BADGE_PALETTE = [
  "bg-yellow-100 text-yellow-800 border border-yellow-300",
  "bg-purple-100 text-purple-800 border border-purple-300",
  "bg-indigo-100 text-indigo-800 border border-indigo-300",
  "bg-amber-100 text-amber-800 border border-amber-300",
  "bg-blue-100 text-blue-800 border border-blue-300",
  "bg-cyan-100 text-cyan-800 border border-cyan-300",
  "bg-orange-100 text-orange-800 border border-orange-300",
  "bg-green-100 text-green-800 border border-green-300",
  "bg-pink-100 text-pink-800 border border-pink-300",
  "bg-gray-100 text-gray-700 border border-gray-300",
];

export function colorForText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return BADGE_PALETTE[Math.abs(hash) % BADGE_PALETTE.length];
}

export const FULFILLMENT_MODE_LABELS: Record<string, string> = {
  QUANTITY: "数量累计型",
  MATCH: "逐场型",
  ROUND: "逐轮型",
  EVENT: "活动次数型",
  ONE_TIME: "一次性",
  CONTINUOUS: "持续型",
};

export const FULFILLMENT_MODE_HINTS: Record<string, string> = {
  QUANTITY: "全季累计完成一定数量(如4条视频),每场可填报本场新增数量",
  MATCH: "每场比赛单独验收履约情况",
  ROUND: "按联赛轮次单独验收(本系统按主场场次处理)",
  EVENT: "全季累计完成一定次数的活动",
  ONE_TIME: "只要有一次通过审核的履约记录即视为完成",
  CONTINUOUS: "检查当前日期是否在有效期内,以及是否发生过中断",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "待填写",
  in_progress: "填写中",
  completed: "已完成",
  issue: "存在问题",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  issue: "bg-red-100 text-red-700",
};

export const FULFILLED_LABELS: Record<string, string> = {
  yes: "已履约",
  no: "未履约",
  partial: "部分履约",
  na: "不适用",
};

export const FULFILLED_COLORS: Record<string, string> = {
  yes: "bg-green-100 text-green-700",
  no: "bg-red-100 text-red-700",
  partial: "bg-yellow-100 text-yellow-700",
  na: "bg-gray-100 text-gray-500",
};

export const PROGRESS_STATUS_LABELS: Record<string, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
  issue: "异常",
};

export const PROGRESS_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  issue: "bg-red-100 text-red-700",
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "待审核",
  approved: "已审核",
  rejected: "已驳回",
};

export const REVIEW_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};
