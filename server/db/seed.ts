import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { clubs, users, matches, sponsors } from "./schema";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Admin123456";

const OPPONENTS = [
  "上海申花",
  "北京国安",
  "广州队",
  "山东泰山",
  "浙江队",
  "武汉三镇",
  "成都蓉城",
  "河南队",
  "青岛海牛",
  "长春亚泰",
  "天津津门虎",
  "深圳新鹏城",
  "梅州客家",
  "沧州雄狮",
  "大连人",
];

export async function runSeed() {
  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existingAdmin) {
    console.log("[seed] Already seeded, skipping.");
    return;
  }

  console.log("[seed] Seeding initial data...");

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const [clubResult] = await db.insert(clubs).values({
    name: "重庆铜梁龙足球俱乐部",
    city: "重庆",
    league: "中超联赛",
    season: "2026",
    isSetupDone: true,
  });
  const clubId = clubResult.insertId;

  await db.insert(users).values({
    openId: `local:${ADMIN_EMAIL}`,
    name: "系统管理员",
    email: ADMIN_EMAIL,
    loginMethod: "local",
    role: "admin",
    clubId,
    passwordHash,
  });

  const matchRows = OPPONENTS.map((opponent, idx) => {
    const round = idx * 2 + 1;
    const matchDate = new Date(2026, 2, 1 + idx * 14); // spread across the season
    return {
      clubId,
      round,
      matchDate,
      isHome: true,
      opponent,
      venue: "重庆铜梁龙体育场",
    };
  });
  await db.insert(matches).values(matchRows);

  await db.insert(sponsors).values([
    {
      clubId,
      name: "重庆啤酒",
      tier: "title" as const,
      contactName: "张经理",
      contactPhone: "13800000001",
      notes: "冠名赞助商，权益优先级最高",
      sortOrder: 1,
    },
    {
      clubId,
      name: "某银行",
      tier: "exclusive_premier" as const,
      contactName: "李经理",
      contactPhone: "13800000002",
      sortOrder: 2,
    },
    {
      clubId,
      name: "某汽车品牌",
      tier: "gold" as const,
      contactName: "王经理",
      contactPhone: "13800000003",
      sortOrder: 3,
    },
    {
      clubId,
      name: "某运动品牌",
      tier: "official" as const,
      contactName: "赵经理",
      contactPhone: "13800000004",
      sortOrder: 4,
    },
  ]);

  console.log("[seed] Done.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
