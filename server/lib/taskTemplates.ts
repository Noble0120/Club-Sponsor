// Default execution subtasks spawned for a new Delivery, chosen by matching keywords in the
// asset's category/name. This is what lets a club skip configuring workflows by hand — every
// delivery gets a sensible checklist automatically.
const CATEGORY_TASK_TEMPLATES: { keywords: string[]; tasks: string[] }[] = [
  { keywords: ["led", "曝光", "广告", "展示", "media", "video", "视频"], tasks: ["Setup", "Final check"] },
  { keywords: ["内容", "content", "social", "社交", "推广", "post"], tasks: ["Draft", "Publish"] },
  { keywords: ["活动", "event", "接待", "hospitality"], tasks: ["Prepare", "Execute", "Wrap up"] },
  { keywords: ["票", "ticket", "门票"], tasks: ["Allocate", "Deliver"] },
  { keywords: ["授权", "ip", "license", "许可"], tasks: ["Verify usage", "Archive proof"] },
];

const DEFAULT_TASKS = ["Setup", "Final check"];

export function getTaskTemplate(category: string, name: string): string[] {
  const haystack = `${category} ${name}`.toLowerCase();
  for (const entry of CATEGORY_TASK_TEMPLATES) {
    if (entry.keywords.some((k) => haystack.includes(k.toLowerCase()))) return entry.tasks;
  }
  return DEFAULT_TASKS;
}
