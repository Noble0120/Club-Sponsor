import {
  mysqlTable,
  int,
  varchar,
  text,
  longtext,
  boolean,
  timestamp,
  mysqlEnum,
  decimal,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const clubs = mysqlTable("clubs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  logoUrl: text("logo_url"),
  season: varchar("season", { length: 20 }).notNull().default("2026"),
  city: varchar("city", { length: 100 }),
  league: varchar("league", { length: 100 }),
  contactEmail: varchar("contact_email", { length: 320 }),
  isSetupDone: boolean("is_setup_done").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).notNull().default("user"),
  clubId: int("club_id"),
  passwordHash: varchar("password_hash", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  lastSignedIn: timestamp("last_signed_in").notNull().defaultNow(),
});

export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  clubId: int("club_id").notNull(),
  round: int("round").notNull(),
  matchDate: timestamp("match_date").notNull(),
  isHome: boolean("is_home").notNull(),
  opponent: varchar("opponent", { length: 100 }).notNull(),
  venue: varchar("venue", { length: 200 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sales pipeline stage — lets the business department track leads and negotiations
// alongside already-signed companies in the same list.
export const companyStageEnum = ["lead", "negotiating", "signed", "lost"] as const;

// Free text so each club can define its own sponsorship tier names.
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  clubId: int("club_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  tier: varchar("tier", { length: 100 }).notNull(),
  stage: mysqlEnum("stage", companyStageEnum).notNull().default("signed"),
  logoUrl: text("logo_url"),
  contactName: varchar("contact_name", { length: 100 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Follow-up log for the business/commercial department: visits, calls, meetings, etc. —
// tracked for leads and negotiating prospects as well as already-signed companies.
export const companyActivityTypeEnum = ["visit", "call", "email", "meeting", "other"] as const;

export const companyActivities = mysqlTable("company_activities", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("company_id").notNull(),
  type: mysqlEnum("type", companyActivityTypeEnum).notNull().default("other"),
  content: text("content").notNull(),
  contactPerson: varchar("contact_person", { length: 100 }),
  followUpDate: timestamp("follow_up_date"),
  createdBy: int("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Stores the club's sponsorship contract documents (PDFs) as a permanent repository, and
// the commercial terms (amount, term dates) the business department tracks. AI scanning
// reads `extractedText` to auto-generate Assets — see lib/assetExtraction.ts.
export const companyContracts = mysqlTable("company_contracts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("company_id").notNull(),
  url: text("url").notNull(),
  fileKey: varchar("file_key", { length: 500 }).notNull(),
  filename: varchar("filename", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  extractedText: longtext("extracted_text"),
  amount: decimal("amount", { precision: 14, scale: 2, mode: "number" }),
  signedDate: timestamp("signed_date"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  uploadedBy: int("uploaded_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A contract's payment/collection schedule, tracked as installments.
export const contractPayments = mysqlTable("contract_payments", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contract_id").notNull(),
  dueDate: timestamp("due_date"),
  amount: decimal("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  status: mysqlEnum("status", ["pending", "paid"]).notNull().default("pending"),
  paidDate: timestamp("paid_date"),
  paidAmount: decimal("paid_amount", { precision: 14, scale: 2, mode: "number" }),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// A reusable "kind" of sponsorship right — the inventory library. AI scanning a contract
// creates these directly (no fulfillment-mode picker); how it gets scheduled is expressed by
// `scope` (free text, e.g. "all home matches" or a specific date range) which the extraction/
// scheduling logic uses to auto-generate Deliveries.
export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("company_id").notNull(),
  contractId: int("contract_id"),
  code: varchar("code", { length: 50 }),
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull().default(""),
  targetCount: int("target_count"),
  countUnit: varchar("count_unit", { length: 20 }),
  scope: text("scope"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  attachmentRequirement: text("attachment_requirement"),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A single scheduled (or not-yet-scheduled) instance of an Asset — the smallest unit shown
// on the Home "Upcoming Deliveries" / "Unscheduled Rights" lists and on the Planning view.
export const deliveryStatusEnum = ["unscheduled", "scheduled", "delivered", "issue"] as const;

export const deliveries = mysqlTable("deliveries", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("asset_id").notNull(),
  matchId: int("match_id"),
  scheduledDate: timestamp("scheduled_date"),
  status: mysqlEnum("status", deliveryStatusEnum).notNull().default("unscheduled"),
  completedCount: int("completed_count"),
  note: text("note"),
  attachmentUrls: text("attachment_urls"),
  // Only "approved" deliveries count toward an asset's official completion progress.
  // Deliveries whose asset has requiresApproval=false are auto-approved on submit.
  reviewStatus: mysqlEnum("review_status", ["pending", "approved", "rejected"])
    .notNull()
    .default("approved"),
  reviewedBy: int("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Execution subtasks under a Delivery — auto-generated from the asset's category (e.g. a
// media asset spawns "Setup" + "Final check") and managed on the Tasks kanban board.
export const taskStatusEnum = ["todo", "in_progress", "done", "cancelled"] as const;

export const deliveryTasks = mysqlTable("delivery_tasks", {
  id: int("id").autoincrement().primaryKey(),
  deliveryId: int("delivery_id").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  status: mysqlEnum("status", taskStatusEnum).notNull().default("todo"),
  assigneeId: int("assignee_id"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  completedBy: int("completed_by"),
  note: text("note"),
  fileUrls: text("file_urls"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["company", "season"]).notNull(),
  companyId: int("company_id"),
  content: text("content").notNull(),
  generatedBy: int("generated_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reportShareTokens = mysqlTable("report_share_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  companyId: int("company_id").notNull(),
  reportId: int("report_id"),
  createdBy: int("created_by").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations (used for convenient nested queries where helpful)
export const companiesRelations = relations(companies, ({ many }) => ({
  assets: many(assets),
  contracts: many(companyContracts),
  activities: many(companyActivities),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  company: one(companies, { fields: [assets.companyId], references: [companies.id] }),
  contract: one(companyContracts, { fields: [assets.contractId], references: [companyContracts.id] }),
  deliveries: many(deliveries),
}));

export const companyContractsRelations = relations(companyContracts, ({ many }) => ({
  payments: many(contractPayments),
  assets: many(assets),
}));

export const contractPaymentsRelations = relations(contractPayments, ({ one }) => ({
  contract: one(companyContracts, { fields: [contractPayments.contractId], references: [companyContracts.id] }),
}));

export const deliveriesRelations = relations(deliveries, ({ one, many }) => ({
  asset: one(assets, { fields: [deliveries.assetId], references: [assets.id] }),
  match: one(matches, { fields: [deliveries.matchId], references: [matches.id] }),
  tasks: many(deliveryTasks),
}));

export const deliveryTasksRelations = relations(deliveryTasks, ({ one }) => ({
  delivery: one(deliveries, { fields: [deliveryTasks.deliveryId], references: [deliveries.id] }),
}));

export type Club = typeof clubs.$inferSelect;
export type User = typeof users.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type CompanyActivity = typeof companyActivities.$inferSelect;
export type CompanyContract = typeof companyContracts.$inferSelect;
export type ContractPayment = typeof contractPayments.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type DeliveryTask = typeof deliveryTasks.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ReportShareToken = typeof reportShareTokens.$inferSelect;
