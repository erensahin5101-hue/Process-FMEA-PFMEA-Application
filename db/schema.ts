import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const processes = sqliteTable("processes", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  family: text("family").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  inputMaterial: text("input_material").notNull().default(""),
  outputMaterial: text("output_material").notNull().default(""),
  equipment: text("equipment").notNull().default(""),
  tooling: text("tooling").notNull().default(""),
  specialProcess: integer("special_process", { mode: "boolean" }).notNull().default(false),
  outsourced: integer("outsourced", { mode: "boolean" }).notNull().default(false),
  controlMethod: text("control_method").notNull().default(""),
  characteristics: text("characteristics", { mode: "json" }).$type<string[]>().notNull().default([]),
  riskTemplate: text("risk_template", { mode: "json" }).$type<string[]>().notNull().default([]),
  reactionPlan: text("reaction_plan").notNull().default(""),
  workInstruction: text("work_instruction").notNull().default(""),
  cycleTimeSec: real("cycle_time_sec").notNull().default(0),
  setupTimeMin: real("setup_time_min").notNull().default(0),
  owner: text("owner").notNull().default("Kalite Mühendisliği"),
  revision: text("revision").notNull().default("A"),
  status: text("status").notNull().default("active"),
  approvalStatus: text("approval_status").notNull().default("draft"),
  documentRef: text("document_ref").notNull().default(""),
  pfmeaFunction: text("pfmea_function").notNull().default(""),
  processStandard: text("process_standard").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => [
  uniqueIndex("processes_code_unique").on(table.code),
  uniqueIndex("processes_name_unique").on(table.name)
]);

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  projectCode: text("project_code").notNull(),
  partNumber: text("part_number").notNull(),
  partName: text("part_name").notNull(),
  productGroup: text("product_group").notNull(),
  revision: text("revision").notNull().default("A"),
  phase: text("phase").notNull().default("Prototip"),
  status: text("status").notNull().default("Taslak"),
  version: integer("version").notNull().default(1),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: text("created_at").notNull()
});
