import { db } from "./db";
import {
  tests, variants, analytics,
  type Test, type Variant, type AnalyticsPoint, type CreateTestRequest, type TestWithVariants
} from "@shared/schema";
import { eq, and, asc, sql } from "drizzle-orm";

export interface IStorage {
  // Tests
  getAllTests(): Promise<Test[]>;
  getTest(id: number): Promise<TestWithVariants | undefined>;
  createTest(test: CreateTestRequest): Promise<TestWithVariants>;
  updateTestWinner(testId: number, winnerVariantId: number): Promise<Test | undefined>;
  
  // Analytics
  getAnalytics(testId: number): Promise<AnalyticsPoint[]>;
  createAnalyticsBatch(points: Omit<AnalyticsPoint, "id">[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAllTests(): Promise<Test[]> {
    return await db.select().from(tests).orderBy(tests.id);
  }

  async getTest(id: number): Promise<TestWithVariants | undefined> {
    const [test] = await db.select().from(tests).where(eq(tests.id, id));
    if (!test) return undefined;

    const testVariants = await db.select().from(variants).where(eq(variants.testId, id));
    
    return {
      ...test,
      variants: testVariants,
    };
  }

  async createTest(req: CreateTestRequest): Promise<TestWithVariants> {
    const [test] = await db.insert(tests).values({
      name: req.name,
      productName: req.productName,
      targetPopulation: req.targetPopulation,
      durationDays: req.durationDays,
      status: "running",
      totalGain: (req as any).totalGain || "+0%",
      conversionUplift: (req as any).conversionUplift || "+0%",
      incomeUplift: (req as any).incomeUplift || "$0",
    }).returning();

    const createdVariants = [];
    for (const v of req.variants) {
      const [variant] = await db.insert(variants).values({
        ...v,
        testId: test.id,
      }).returning();
      createdVariants.push(variant);
    }

    return {
      ...test,
      variants: createdVariants,
    };
  }

  async getAnalytics(testId: number): Promise<AnalyticsPoint[]> {
    return await db.select()
      .from(analytics)
      .where(eq(analytics.testId, testId))
      .orderBy(asc(analytics.timestamp));
  }

  async createAnalyticsBatch(points: Omit<AnalyticsPoint, "id">[]): Promise<void> {
    if (points.length === 0) return;
    await db.insert(analytics).values(points);
  }

  async updateTestWinner(testId: number, winnerVariantId: number): Promise<Test | undefined> {
    const [updated] = await db.update(tests)
      .set({ 
        winnerVariantId: winnerVariantId,
        status: "winner_applied"
      })
      .where(eq(tests.id, testId))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
