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
// alongside already-signed sponsors in the same list.
export const sponsorStageEnum = ["lead", "negotiating", "signed", "lost"] as const;

// Free text so each club can define its own sponsorship tier names.
export const sponsors = mysqlTable("sponsors", {
  id: int("id").autoincrement().primaryKey(),
  clubId: int("club_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  tier: varchar("tier", { length: 100 }).notNull(),
  stage: mysqlEnum("stage", sponsorStageEnum).notNull().default("signed"),
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
// tracked for leads and negotiating prospects as well as already-signed sponsors.
export const sponsorActivityTypeEnum = ["visit", "call", "email", "meeting", "other"] as const;

export const sponsorActivities = mysqlTable("sponsor_activities", {
  id: int("id").autoincrement().primaryKey(),
  sponsorId: int("sponsor_id").notNull(),
  type: mysqlEnum("type", sponsorActivityTypeEnum).notNull().default("other"),
  content: text("content").notNull(),
  contactPerson: varchar("contact_person", { length: 100 }),
  followUpDate: timestamp("follow_up_date"),
  createdBy: int("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// How a benefit's fulfillment is measured/tracked over the season:
// QUANTITY   - cumulative count toward a target (e.g. 4 LED videos delivered across matches)
// MATCH      - checked individually for every applicable match
// ROUND      - checked individually per league round (treated like MATCH since this system
//              only tracks home matches, so round <-> match is effectively 1:1)
// EVENT      - cumulative count of planned activities/events (same math as QUANTITY)
// ONE_TIME   - a single approved fulfillment, ever, marks it done permanently
// CONTINUOUS - considered satisfied while today is within [startDate, endDate] and no
//              approved check-in has reported an interruption
export const fulfillmentModeEnum = [
  "QUANTITY",
  "MATCH",
  "ROUND",
  "EVENT",
  "ONE_TIME",
  "CONTINUOUS",
] as const;

export const benefitItems = mysqlTable("benefit_items", {
  id: int("id").autoincrement().primaryKey(),
  sponsorId: int("sponsor_id").notNull(),
  code: varchar("code", { length: 50 }),
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  fulfillmentMode: mysqlEnum("fulfillment_mode", fulfillmentModeEnum).notNull().default("MATCH"),
  targetCount: int("target_count"),
  countUnit: varchar("count_unit", { length: 20 }),
  category: varchar("category", { length: 100 }).notNull().default(""),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  scope: text("scope"),
  attachmentRequirement: text("attachment_requirement"),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  assigneeId: int("assignee_id"),
  contractNote: text("contract_note"),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Stores the club's sponsor contract documents (PDFs) as a permanent repository, separate
// from the transient AI extraction flow that reads them to auto-populate benefit_items.
// Also carries the commercial terms (amount, term dates) the business department tracks.
export const sponsorContracts = mysqlTable("sponsor_contracts", {
  id: int("id").autoincrement().primaryKey(),
  sponsorId: int("sponsor_id").notNull(),
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

// A contract's payment/collection schedule (回款计划), tracked as installments.
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

export const acceptanceRecords = mysqlTable("acceptance_records", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("match_id").notNull(),
  sponsorId: int("sponsor_id").notNull(),
  submittedBy: int("submitted_by").notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "issue"])
    .notNull()
    .default("in_progress"),
  overallRating: int("overall_rating"),
  summary: text("summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const benefitCheckItems = mysqlTable("benefit_check_items", {
  id: int("id").autoincrement().primaryKey(),
  recordId: int("record_id").notNull(),
  benefitItemId: int("benefit_item_id").notNull(),
  fulfilled: mysqlEnum("fulfilled", ["yes", "no", "partial", "na"]).notNull().default("na"),
  note: text("note"),
  completedCount: int("completed_count"),
  attachmentUrls: text("attachment_urls"),
  // Only "approved" check-ins count toward a benefit item's official completion progress.
  // Items with requiresApproval=false are auto-approved on submit.
  reviewStatus: mysqlEnum("review_status", ["pending", "approved", "rejected"])
    .notNull()
    .default("approved"),
  reviewedBy: int("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const recordImages = mysqlTable("record_images", {
  id: int("id").autoincrement().primaryKey(),
  recordId: int("record_id").notNull(),
  url: text("url").notNull(),
  fileKey: varchar("file_key", { length: 500 }).notNull(),
  filename: varchar("filename", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  sortOrder: int("sort_order").notNull().default(0),
  uploadedBy: int("uploaded_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["sponsor", "season"]).notNull(),
  sponsorId: int("sponsor_id"),
  content: text("content").notNull(),
  generatedBy: int("generated_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reportShareTokens = mysqlTable("report_share_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  sponsorId: int("sponsor_id").notNull(),
  reportId: int("report_id"),
  createdBy: int("created_by").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sopTemplates = mysqlTable("sop_templates", {
  id: int("id").autoincrement().primaryKey(),
  clubId: int("club_id").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  autoGenerateDaysBefore: int("auto_generate_days_before"),
  createdBy: int("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const sopSteps = mysqlTable("sop_steps", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("template_id").notNull(),
  stepOrder: int("step_order").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  dueDayOffset: int("due_day_offset").notNull().default(-1),
  requiresFile: boolean("requires_file").notNull().default(false),
  requiresNote: boolean("requires_note").notNull().default(false),
  defaultAssigneeId: int("default_assignee_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const workflowInstances = mysqlTable("workflow_instances", {
  id: int("id").autoincrement().primaryKey(),
  clubId: int("club_id").notNull(),
  templateId: int("template_id").notNull(),
  matchId: int("match_id").notNull(),
  currentStepOrder: int("current_step_order").notNull().default(1),
  status: mysqlEnum("status", ["active", "completed", "overdue"]).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const workflowStepExecutions = mysqlTable("workflow_step_executions", {
  id: int("id").autoincrement().primaryKey(),
  clubId: int("club_id").notNull(),
  instanceId: int("instance_id").notNull(),
  stepId: int("step_id").notNull(),
  stepOrder: int("step_order").notNull(),
  assigneeId: int("assignee_id"),
  status: mysqlEnum("status", ["pending", "active", "completed", "overdue"])
    .notNull()
    .default("pending"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  completedBy: int("completed_by"),
  note: text("note"),
  fileUrls: text("file_urls"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Relations (used for convenient nested queries where helpful)
export const sponsorsRelations = relations(sponsors, ({ many }) => ({
  benefitItems: many(benefitItems),
}));

export const benefitItemsRelations = relations(benefitItems, ({ one }) => ({
  sponsor: one(sponsors, { fields: [benefitItems.sponsorId], references: [sponsors.id] }),
}));

export const acceptanceRecordsRelations = relations(acceptanceRecords, ({ many }) => ({
  checkItems: many(benefitCheckItems),
}));

export const benefitCheckItemsRelations = relations(benefitCheckItems, ({ one }) => ({
  record: one(acceptanceRecords, {
    fields: [benefitCheckItems.recordId],
    references: [acceptanceRecords.id],
  }),
  benefitItem: one(benefitItems, {
    fields: [benefitCheckItems.benefitItemId],
    references: [benefitItems.id],
  }),
}));

export const sopTemplatesRelations = relations(sopTemplates, ({ many }) => ({
  steps: many(sopSteps),
}));

export const sopStepsRelations = relations(sopSteps, ({ one }) => ({
  template: one(sopTemplates, { fields: [sopSteps.templateId], references: [sopTemplates.id] }),
}));

export const workflowInstancesRelations = relations(workflowInstances, ({ many }) => ({
  executions: many(workflowStepExecutions),
}));

export const workflowStepExecutionsRelations = relations(workflowStepExecutions, ({ one }) => ({
  instance: one(workflowInstances, {
    fields: [workflowStepExecutions.instanceId],
    references: [workflowInstances.id],
  }),
}));

export type Club = typeof clubs.$inferSelect;
export type User = typeof users.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Sponsor = typeof sponsors.$inferSelect;
export type SponsorActivity = typeof sponsorActivities.$inferSelect;
export type SponsorContract = typeof sponsorContracts.$inferSelect;
export type ContractPayment = typeof contractPayments.$inferSelect;
export type BenefitItem = typeof benefitItems.$inferSelect;
export type AcceptanceRecord = typeof acceptanceRecords.$inferSelect;
export type BenefitCheckItem = typeof benefitCheckItems.$inferSelect;
export type RecordImage = typeof recordImages.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ReportShareToken = typeof reportShareTokens.$inferSelect;
export type SopTemplate = typeof sopTemplates.$inferSelect;
export type SopStep = typeof sopSteps.$inferSelect;
export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type WorkflowStepExecution = typeof workflowStepExecutions.$inferSelect;
