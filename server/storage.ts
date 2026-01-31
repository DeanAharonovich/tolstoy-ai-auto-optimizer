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
  updateTest(testId: number, test: Partial<CreateTestRequest>): Promise<TestWithVariants | undefined>;
  updateTestWinner(testId: number, winnerVariantId: number): Promise<Test | undefined>;
  updateTestStatus(testId: number, status: string): Promise<Test | undefined>;
  
  // Analytics
  getAnalytics(testId: number, timeRange?: TimeRange): Promise<AnalyticsPoint[]>;
  createAnalyticsBatch(points: Omit<AnalyticsPoint, "id">[]): Promise<void>;
  
  // Aggregate Metrics
  getAggregateMetrics(): Promise<{
    totalConversionUplift: string;
    totalIncomeUplift: string;
    activeTests: number;
    totalReach: number;
  }>;
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
      status: (req as any).status || "draft",
      totalGain: (req as any).totalGain || null,
      conversionUplift: (req as any).conversionUplift || null,
      incomeUplift: (req as any).incomeUplift || null,
      isMock: (req as any).isMock || false,
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
    // Insert in batches of 500 to avoid postgres parameter limit
    const batchSize = 500;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await db.insert(analytics).values(batch);
    }
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

  async getAggregateMetrics(): Promise<{ 
    totalConversionUplift: string; 
    totalIncomeUplift: string;
    activeTests: number;
    totalReach: number;
  }> {
    const allTests = await db.select().from(tests);
    
    let totalConversionPercent = 0;
    let totalIncomeDollars = 0;
    let testsWithMetrics = 0;
    let activeTests = 0;
    let totalReach = 0;

    for (const test of allTests) {
      totalReach += test.targetPopulation;
      
      if (test.status === 'running') {
        activeTests++;
      }
      
      if (test.conversionUplift) {
        const match = test.conversionUplift.match(/([+-]?\d+\.?\d*)%?/);
        if (match) {
          totalConversionPercent += parseFloat(match[1]);
          testsWithMetrics++;
        }
      }
      
      if (test.incomeUplift) {
        const match = test.incomeUplift.match(/([+-]?\$?)([\d,]+\.?\d*)/);
        if (match) {
          totalIncomeDollars += parseFloat(match[2].replace(/,/g, ''));
        }
      }
    }

    const avgConversion = testsWithMetrics > 0 
      ? (totalConversionPercent / testsWithMetrics).toFixed(1) 
      : "0";

    return {
      totalConversionUplift: testsWithMetrics > 0 ? `+${avgConversion}%` : "—",
      totalIncomeUplift: totalIncomeDollars > 0 ? `+$${totalIncomeDollars.toLocaleString()}` : "—",
      activeTests,
      totalReach
    };
  }

  async updateTestStatus(testId: number, status: string): Promise<Test | undefined> {
    const [updated] = await db.update(tests)
      .set({ status })
      .where(eq(tests.id, testId))
      .returning();
    return updated;
  }

  async updateTest(testId: number, req: Partial<CreateTestRequest>): Promise<TestWithVariants | undefined> {
    const [test] = await db.update(tests)
      .set({
        name: req.name,
        productName: req.productName,
        targetPopulation: req.targetPopulation,
        durationDays: req.durationDays,
      })
      .where(eq(tests.id, testId))
      .returning();
    
    if (!test) return undefined;

    if (req.variants) {
      await db.delete(variants).where(eq(variants.testId, testId));
      for (const v of req.variants) {
        await db.insert(variants).values({
          ...v,
          testId: test.id,
        });
      }
    }

    const testVariants = await db.select().from(variants).where(eq(variants.testId, testId));
    return { ...test, variants: testVariants };
  }
}

export const storage = new DatabaseStorage();
