export const TIER_LABELS: Record<string, string> = {
  title: "冠名赞助商",
  exclusive_premier: "独家首席合作伙伴",
  exclusive_premium: "独家尊享合作伙伴",
  gold: "黄金赞助商",
  official: "官方合作伙伴",
  supplier: "官方指定供应商",
};

export const TIER_COLORS: Record<string, string> = {
  title: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  exclusive_premier: "bg-purple-100 text-purple-800 border border-purple-300",
  exclusive_premium: "bg-indigo-100 text-indigo-800 border border-indigo-300",
  gold: "bg-amber-100 text-amber-800 border border-amber-300",
  official: "bg-blue-100 text-blue-800 border border-blue-300",
  supplier: "bg-gray-100 text-gray-700 border border-gray-300",
};

export const CATEGORY_LABELS: Record<string, string> = {
  ad_exposure: "广告曝光",
  ticketing: "票务接待",
  content: "内容制作",
  media: "数字传播",
  activity: "活动合作",
  ip_license: "授权及IP",
  product: "产品服务",
};

export const CATEGORY_COLORS: Record<string, string> = {
  ad_exposure: "bg-red-50 text-red-700 border-red-200",
  ticketing: "bg-blue-50 text-blue-700 border-blue-200",
  content: "bg-purple-50 text-purple-700 border-purple-200",
  media: "bg-cyan-50 text-cyan-700 border-cyan-200",
  activity: "bg-orange-50 text-orange-700 border-orange-200",
  ip_license: "bg-amber-50 text-amber-700 border-amber-200",
  product: "bg-green-50 text-green-700 border-green-200",
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
