import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { subHours, subDays, subWeeks, subMonths } from "date-fns";
import { DEMO_TEST, generateMockAnalytics } from "./mockData";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function seedDatabase() {
  const existingTests = await storage.getAllTests();
  if (existingTests.length > 0) return;

  console.log("Seeding database with demo data...");

  const demoTest = await storage.createTest({
    name: DEMO_TEST.name,
    productName: DEMO_TEST.productName,
    targetPopulation: DEMO_TEST.targetPopulation,
    durationDays: DEMO_TEST.durationDays,
    status: DEMO_TEST.status,
    conversionUplift: DEMO_TEST.conversionUplift,
    incomeUplift: DEMO_TEST.incomeUplift,
    totalGain: DEMO_TEST.totalGain,
    isMock: true,
    variants: DEMO_TEST.variants
  });

  const variantIds = demoTest.variants.map(v => v.id);
  const analyticsData = generateMockAnalytics(demoTest.id, variantIds, 30);
  
  await storage.createAnalyticsBatch(analyticsData);
  console.log("Demo database seeded successfully with 1 mock test");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed on startup
  seedDatabase().catch(console.error);

  app.get(api.tests.list.path, async (req, res) => {
    const tests = await storage.getAllTests();
    res.json(tests);
  });

  app.get(api.tests.get.path, async (req, res) => {
    const test = await storage.getTest(Number(req.params.id));
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }
    res.json(test);
  });

  app.post(api.tests.create.path, async (req, res) => {
    try {
      const input = api.tests.create.input.parse(req.body);
      const test = await storage.createTest(input);
      res.status(201).json(test);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.tests.analytics.path, async (req, res) => {
    const timeRange = req.query.timeRange as '1h' | '1d' | '1w' | '1m' | undefined;
    const analytics = await storage.getAnalytics(Number(req.params.id), timeRange);
    res.json(analytics);
  });

  app.get("/api/metrics/aggregate", async (req, res) => {
    const metrics = await storage.getAggregateMetrics();
    res.json(metrics);
  });

  app.post(api.tests.applyWinner.path, async (req, res) => {
    const testId = Number(req.params.id);
    const { winnerVariantId } = req.body;
    
    if (!winnerVariantId) {
      return res.status(400).json({ message: "winnerVariantId is required" });
    }
    
    const test = await storage.updateTestWinner(testId, winnerVariantId);
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }
    res.json(test);
  });

  app.post("/api/tests/:id/start", async (req, res) => {
    const test = await storage.updateTestStatus(Number(req.params.id), "running");
    if (!test) return res.status(404).json({ message: "Test not found" });
    res.json(test);
  });

  app.patch("/api/tests/:id", async (req, res) => {
    const testId = Number(req.params.id);
    const existing = await storage.getTest(testId);
    if (!existing) return res.status(404).json({ message: "Test not found" });
    if (existing.status !== "draft") return res.status(400).json({ message: "Can only edit draft tests" });
    
    const input = api.tests.create.input.partial().parse(req.body);
    const updated = await storage.updateTest(testId, input as any);
    res.json(updated);
  });

  app.post(api.tests.analyze.path, async (req, res) => {
    const testId = Number(req.params.id);
    const test = await storage.getTest(testId);
    
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const analyticsData = await storage.getAnalytics(testId, '1w');
    
    const variantStats = test.variants.map(variant => {
      const variantData = analyticsData.filter(a => a.variantId === variant.id);
      const latestData = variantData[variantData.length - 1];
      return {
        name: variant.name,
        description: variant.description,
        views: latestData?.views || 0,
        conversions: latestData?.conversions || 0,
        interactions: latestData?.interactions || 0,
        conversionRate: latestData?.views > 0 
          ? ((latestData.conversions / latestData.views) * 100).toFixed(2) 
          : "0"
      };
    });

    const prompt = `You are an A/B testing analytics expert. Analyze the following test results and provide insights.

Test: "${test.name}" (Product: ${test.productName})
Duration: ${test.durationDays} days
Target Population: ${test.targetPopulation.toLocaleString()}

Variant Performance Data:
${variantStats.map((v, i) => `
Variant ${i + 1}: ${v.name}
- Description: ${v.description || 'No description'}
- Total Views: ${v.views.toLocaleString()}
- Total Conversions: ${v.conversions}
- Conversion Rate: ${v.conversionRate}%
- Interactions: ${v.interactions}
`).join('\n')}

Provide a brief analysis in JSON format with exactly these keys:
- "summary": A 1-2 sentence summary of the performance difference and which variant is performing better
- "recommendation": A clear recommendation on which variant to choose and why

Return ONLY valid JSON, no markdown.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const analysis = JSON.parse(content);
      res.json(analysis);
      
    } catch (error) {
      console.error("AI Analysis failed:", error);
      res.status(500).json({ message: "Failed to generate analysis" });
    }
  });

  return httpServer;
}
