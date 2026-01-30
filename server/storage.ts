import { db } from "./db";
import {
  tests, variants, analytics,
  type Test, type Variant, type AnalyticsPoint, type CreateTestRequest, type TestWithVariants
} from "@shared/schema";
import { eq, and, asc, gte, sql } from "drizzle-orm";

export type TimeRange = '1h' | '1d' | '1w' | '1m';

export interface IStorage {
  // Tests
  getAllTests(): Promise<Test[]>;
  getTest(id: number): Promise<TestWithVariants | undefined>;
  createTest(test: CreateTestRequest): Promise<TestWithVariants>;
  updateTestWinner(testId: number, winnerVariantId: number): Promise<Test | undefined>;
  
  // Analytics
  getAnalytics(testId: number, timeRange?: TimeRange): Promise<AnalyticsPoint[]>;
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

  async getAnalytics(testId: number, timeRange?: TimeRange): Promise<AnalyticsPoint[]> {
    // Calculate the start date based on time range
    const now = new Date();
    let startDate: Date;
    let granularityMinutes: number;
    
    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        granularityMinutes = 15; // 15 minute intervals
        break;
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        granularityMinutes = 120; // 2 hour intervals
        break;
      case '1w':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        granularityMinutes = 24 * 60; // 1 day intervals
        break;
      case '1m':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        granularityMinutes = 7 * 24 * 60; // 1 week intervals
        break;
    }
    
    // Fetch all data points in the time range
    const allPoints = await db.select()
      .from(analytics)
      .where(and(
        eq(analytics.testId, testId),
        gte(analytics.timestamp, startDate)
      ))
      .orderBy(asc(analytics.timestamp));
    
    if (allPoints.length === 0) return [];
    
    // Group points by variant and time bucket, taking the last value in each bucket
    const bucketMs = granularityMinutes * 60 * 1000;
    const groupedByVariant = new Map<number, Map<number, AnalyticsPoint>>();
    
    for (const point of allPoints) {
      const bucketStart = Math.floor(new Date(point.timestamp).getTime() / bucketMs) * bucketMs;
      
      if (!groupedByVariant.has(point.variantId)) {
        groupedByVariant.set(point.variantId, new Map());
      }
      
      const variantBuckets = groupedByVariant.get(point.variantId)!;
      // Keep the latest point in each bucket (for cumulative data, this is the max value)
      variantBuckets.set(bucketStart, point);
    }
    
    // Flatten back to array, sorted by timestamp
    const result: AnalyticsPoint[] = [];
    groupedByVariant.forEach((buckets) => {
      buckets.forEach((point) => {
        result.push(point);
      });
    });
    
    return result.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
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
