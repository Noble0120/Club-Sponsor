// Company tier and asset category are free text so each club can define their own —
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

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  unscheduled: "未排期",
  scheduled: "已排期",
  delivered: "已交付",
  issue: "存在问题",
};

export const DELIVERY_STATUS_COLORS: Record<string, string> = {
  unscheduled: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
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

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "待办",
  in_progress: "进行中",
  done: "已完成",
  cancelled: "已取消",
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-gray-200 text-gray-500",
};

export const TASK_BOARD_COLUMNS: { status: string; label: string }[] = [
  { status: "todo", label: "待办" },
  { status: "in_progress", label: "进行中" },
  { status: "done", label: "已完成" },
  { status: "cancelled", label: "已取消" },
];

export const COMPANY_STAGE_LABELS: Record<string, string> = {
  lead: "潜在客户",
  negotiating: "洽谈中",
  signed: "已签约",
  lost: "已流失",
};

export const COMPANY_STAGE_COLORS: Record<string, string> = {
  lead: "bg-gray-100 text-gray-600",
  negotiating: "bg-blue-100 text-blue-700",
  signed: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-600",
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  visit: "拜访",
  call: "电话",
  email: "邮件",
  meeting: "会议",
  other: "其他",
};

export const ASSET_PROGRESS_STATUS_LABELS: Record<string, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
  issue: "异常",
};

export const ASSET_PROGRESS_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  issue: "bg-red-100 text-red-700",
};
