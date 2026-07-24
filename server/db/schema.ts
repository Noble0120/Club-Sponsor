import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  timestamp,
  mysqlEnum,
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

export const sponsorTierEnum = [
  "title",
  "exclusive_premier",
  "exclusive_premium",
  "gold",
  "official",
  "supplier",
] as const;

export const sponsors = mysqlTable("sponsors", {
  id: int("id").autoincrement().primaryKey(),
  clubId: int("club_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  tier: mysqlEnum("tier", sponsorTierEnum).notNull(),
  logoUrl: text("logo_url"),
  contactName: varchar("contact_name", { length: 100 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const benefitCategoryEnum = [
  "ad_exposure",
  "ticketing",
  "content",
  "media",
  "activity",
  "ip_license",
  "product",
] as const;

export const benefitItems = mysqlTable("benefit_items", {
  id: int("id").autoincrement().primaryKey(),
  sponsorId: int("sponsor_id").notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  itemType: mysqlEnum("item_type", ["per_match", "season"]).notNull().default("per_match"),
  totalCount: int("total_count"),
  countUnit: varchar("count_unit", { length: 20 }),
  category: mysqlEnum("category", benefitCategoryEnum).notNull().default("ad_exposure"),
  categoryLabel: varchar("category_label", { length: 100 }),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
