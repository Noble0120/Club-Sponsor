import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { clubs, users, matches, sponsors, benefitItems } from "./schema";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Admin123456";

const OPPONENTS = [
  "示例对手1",
  "示例对手2",
  "示例对手3",
  "示例对手4",
  "示例对手5",
  "示例对手6",
  "示例对手7",
  "示例对手8",
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
    name: "示例足球俱乐部",
    city: "示例市",
    league: "示例联赛",
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
      venue: "示例主场体育场",
    };
  });
  await db.insert(matches).values(matchRows);

  const [sponsorAResult] = await db.insert(sponsors).values({
    clubId,
    name: "示例品牌A",
    tier: "冠名赞助商",
    contactName: "张经理",
    contactPhone: "13800000001",
    notes: "示例数据，可在赞助商管理中编辑或删除",
    sortOrder: 1,
  });
  const [sponsorBResult] = await db.insert(sponsors).values({
    clubId,
    name: "示例品牌B",
    tier: "官方合作伙伴",
    contactName: "李经理",
    contactPhone: "13800000002",
    sortOrder: 2,
  });

  await db.insert(benefitItems).values([
    {
      sponsorId: sponsorAResult.insertId,
      code: "R001",
      name: "LED视频制作",
      category: "媒体曝光",
      fulfillmentMode: "QUANTITY",
      targetCount: 4,
      countUnit: "条",
      startDate: new Date(2026, 2, 1),
      endDate: new Date(2026, 10, 30),
      scope: "全赛季",
      attachmentRequirement: "必须上传视频文件",
      requiresApproval: true,
      contractNote: "全季制作并交付4条LED视频",
    },
    {
      sponsorId: sponsorAResult.insertId,
      code: "R002",
      name: "主场LED播放",
      category: "媒体曝光",
      fulfillmentMode: "MATCH",
      targetCount: 8,
      countUnit: "场",
      startDate: new Date(2026, 2, 1),
      endDate: new Date(2026, 10, 30),
      scope: "全部主场比赛",
      attachmentRequirement: "上传现场照片/视频",
      requiresApproval: true,
      contractNote: "每个主场至少播放1次",
    },
    {
      sponsorId: sponsorBResult.insertId,
      code: "R003",
      name: "IP形象授权",
      category: "知识产权",
      fulfillmentMode: "ONE_TIME",
      startDate: new Date(2026, 0, 1),
      endDate: new Date(2026, 11, 31),
      scope: "指定产品及渠道",
      attachmentRequirement: "上传授权书",
      requiresApproval: true,
      contractNote: "授权期内持续有效",
    },
    {
      sponsorId: sponsorBResult.insertId,
      code: "R004",
      name: "球迷开放日",
      category: "活动权益",
      fulfillmentMode: "EVENT",
      targetCount: 2,
      countUnit: "次",
      startDate: new Date(2026, 2, 1),
      endDate: new Date(2026, 10, 30),
      scope: "合同约定活动",
      attachmentRequirement: "上传活动方案及照片",
      requiresApproval: true,
      contractNote: "全年举办2次",
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
