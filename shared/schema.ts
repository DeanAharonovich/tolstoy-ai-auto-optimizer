import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const tests = pgTable("tests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"), // 'draft' | 'running' | 'completed' | 'winner_applied'
  productName: text("product_name").notNull(),
  targetPopulation: integer("target_population").notNull(),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time").notNull(),
  startDate: timestamp("start_date").defaultNow(),
  // Summary stats (cached for list view)
  totalGain: text("total_gain"), // e.g. "+24%"
  conversionUplift: text("conversion_uplift"), // e.g. "+18%"
  incomeUplift: text("income_uplift"), // e.g. "+$2,450"
  winnerVariantId: integer("winner_variant_id"), // ID of the selected winning variant
  isMock: boolean("is_mock").notNull().default(false), // Indicates demo/mock data for presentation
  // Autonomous Optimization Settings
  autonomousOptimization: boolean("autonomous_optimization").notNull().default(false),
  minSampleSize: integer("min_sample_size").notNull().default(100), // Minimum views before AI acts
  killSwitchThreshold: real("kill_switch_threshold").notNull().default(30), // % below average to disable
  autoWinThreshold: real("auto_win_threshold").notNull().default(50), // % uplift to declare winner
});

export const variants = pgTable("variants", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull(),
  name: text("name").notNull(), // 'Variant A', 'Variant B'
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  description: text("description"),
  // Autonomous optimization fields
  variantStatus: text("variant_status").notNull().default("active"), // 'active' | 'disabled' | 'winner'
  statusReason: text("status_reason"), // Reason for status change (AI explanation)
});

// AI Activity Log - tracks autonomous actions
export const aiActivityLog = pgTable("ai_activity_log", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull(),
  variantId: integer("variant_id"),
  action: text("action").notNull(), // 'disabled_variant' | 'promoted_winner' | 'evaluation'
  message: text("message").notNull(), // Human-readable description
  metadata: jsonb("metadata"), // Additional data (performance metrics, thresholds, etc.)
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Granular analytics data for charts
export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull(),
  variantId: integer("variant_id").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  views: integer("views").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  interactions: integer("interactions").notNull().default(0),
});

// === RELATIONS ===
export const variantsRelations = relations(variants, ({ one }) => ({
  test: one(tests, {
    fields: [variants.testId],
    references: [tests.id],
  }),
}));

export const analyticsRelations = relations(analytics, ({ one }) => ({
  test: one(tests, {
    fields: [analytics.testId],
    references: [tests.id],
  }),
  variant: one(variants, {
    fields: [analytics.variantId],
    references: [variants.id],
  }),
}));

export const aiActivityLogRelations = relations(aiActivityLog, ({ one }) => ({
  test: one(tests, {
    fields: [aiActivityLog.testId],
    references: [tests.id],
  }),
  variant: one(variants, {
    fields: [aiActivityLog.variantId],
    references: [variants.id],
  }),
}));

export const testsRelations = relations(tests, ({ many }) => ({
  variants: many(variants),
  analytics: many(analytics),
  activityLog: many(aiActivityLog),
}));

// === BASE SCHEMAS ===
export const insertTestSchema = createInsertSchema(tests).omit({ id: true, startDate: true });
export const insertVariantSchema = createInsertSchema(variants).omit({ id: true });
export const insertAnalyticsSchema = createInsertSchema(analytics).omit({ id: true });
export const insertAiActivityLogSchema = createInsertSchema(aiActivityLog).omit({ id: true });

// === EXPLICIT API CONTRACT TYPES ===
export type Test = typeof tests.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type AnalyticsPoint = typeof analytics.$inferSelect;
export type AiActivityLogEntry = typeof aiActivityLog.$inferSelect;

export type CreateTestRequest = z.infer<typeof insertTestSchema> & {
  variants: Omit<z.infer<typeof insertVariantSchema>, "testId">[];
};

export type TestWithVariants = Test & {
  variants: Variant[];
};

export type TestDetailResponse = TestWithVariants & {
  analytics: AnalyticsPoint[];
};

export type AnalysisRequest = {
  testId: number;
};

export type AnalysisResponse = {
  summary: string;
  winningVariantReasoning: string;
  estimatedRevenueGrowth: string;
  nextSteps: string[];
  metrics: {
    variantName: string;
    conversionRate: number;
    views: number;
    conversions: number;
    uplift?: number;
  }[];
  statisticalSignificance: string;
  confidence: number;
};
