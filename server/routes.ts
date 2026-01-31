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
    startTime: DEMO_TEST.startTime,
    endTime: DEMO_TEST.endTime,
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
    
    // Validate partial update
    const updated = await storage.updateTest(testId, req.body);
    res.json(updated);
  });

  app.post(api.tests.analyze.path, async (req, res) => {
    const testId = Number(req.params.id);
    const test = await storage.getTest(testId);
    
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    // Fetch ALL analytics data for comprehensive analysis
    const analyticsData = await storage.getAnalytics(testId, '1m');
    
    // Calculate advanced metrics per variant
    const variantStats = test.variants.map(variant => {
      const variantData = analyticsData.filter(a => a.variantId === variant.id);
      const latestData = variantData[variantData.length - 1];
      const views = latestData?.views || 0;
      const conversions = latestData?.conversions || 0;
      const conversionRate = views > 0 ? (conversions / views) * 100 : 0;
      
      return {
        variantId: variant.id,
        name: variant.name,
        description: variant.description,
        views,
        conversions,
        interactions: latestData?.interactions || 0,
        conversionRate: parseFloat(conversionRate.toFixed(3))
      };
    });

    // Find baseline (first variant) and calculate uplift for others
    const baseline = variantStats[0];
    const metricsWithUplift = variantStats.map((v, idx) => ({
      variantName: v.name,
      conversionRate: v.conversionRate,
      views: v.views,
      conversions: v.conversions,
      uplift: idx === 0 ? undefined : 
        baseline.conversionRate > 0 
          ? parseFloat(((v.conversionRate - baseline.conversionRate) / baseline.conversionRate * 100).toFixed(2))
          : 0
    }));

    // Calculate statistical significance using proper two-tailed z-test
    function calculateStatisticalSignificance(
      conversions1: number, views1: number,
      conversions2: number, views2: number
    ): { significant: boolean; confidence: number; pValue: number } {
      if (views1 === 0 || views2 === 0) {
        return { significant: false, confidence: 0, pValue: 1 };
      }
      
      const p1 = conversions1 / views1;
      const p2 = conversions2 / views2;
      const pPooled = (conversions1 + conversions2) / (views1 + views2);
      
      const se = Math.sqrt(pPooled * (1 - pPooled) * (1/views1 + 1/views2));
      if (se === 0) return { significant: false, confidence: 0, pValue: 1 };
      
      const z = Math.abs(p1 - p2) / se;
      
      // Approximate two-tailed p-value using error function approximation
      // Using Abramowitz and Stegun approximation for normal CDF
      function normalCDF(x: number): number {
        const a1 =  0.254829592;
        const a2 = -0.284496736;
        const a3 =  1.421413741;
        const a4 = -1.453152027;
        const a5 =  1.061405429;
        const p  =  0.3275911;
        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2);
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return 0.5 * (1.0 + sign * y);
      }
      
      // Two-tailed p-value
      const pValue = 2 * (1 - normalCDF(z));
      const confidence = Math.min(99.9, Math.max(0, (1 - pValue) * 100));
      
      return {
        significant: pValue < 0.05, // 95% significance threshold
        confidence: parseFloat(confidence.toFixed(1)),
        pValue: parseFloat(pValue.toFixed(4))
      };
    }

    // Compare best performing variant to baseline
    const bestVariant = variantStats.reduce((best, curr) => 
      curr.conversionRate > best.conversionRate ? curr : best
    );
    
    const significance = variantStats.length >= 2 
      ? calculateStatisticalSignificance(
          baseline.conversions, baseline.views,
          bestVariant.conversions, bestVariant.views
        )
      : { significant: false, confidence: 0, pValue: 1 };

    // Calculate test duration
    const durationDays = Math.ceil(
      (new Date(test.endTime).getTime() - new Date(test.startTime).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Build comprehensive prompt for AI analysis
    const prompt = `You are a senior e-commerce conversion optimization expert analyzing A/B test results for video content.

## Test Context
- Test Name: "${test.name}"
- Product: ${test.productName}
- Target Audience: ${test.targetPopulation.toLocaleString()} users
- Duration: ${durationDays} days
- Current Status: ${test.status}

## Variant Performance Data
${variantStats.map((v, i) => `
### ${v.name} ${i === 0 ? '(Control)' : `(Test Variant ${i})`}
- Description: ${v.description || 'No description provided'}
- Total Impressions: ${v.views.toLocaleString()}
- Total Conversions: ${v.conversions.toLocaleString()}
- Conversion Rate: ${v.conversionRate.toFixed(3)}%
- Interactions: ${v.interactions.toLocaleString()}
${i > 0 ? `- Uplift vs Control: ${metricsWithUplift[i].uplift}%` : ''}
`).join('\n')}

## Statistical Analysis
- Statistical Significance: ${significance.significant ? 'YES' : 'NO'} (${significance.confidence}% confidence)
- Best Performer: ${bestVariant.name} with ${bestVariant.conversionRate.toFixed(3)}% conversion rate

## Your Task
Provide a professional, data-driven analysis in JSON format with these exact keys:
1. "summary": A 2-3 sentence executive summary explaining the key findings and which variant is winning.
2. "winningVariantReasoning": A detailed explanation (3-4 sentences) of WHY the winning variant performed better. Consider video content strategy, user psychology, and e-commerce best practices.
3. "estimatedRevenueGrowth": A realistic percentage estimate of potential revenue growth if the winning variant is implemented (e.g., "+12-18%"). Base this on the conversion uplift data.
4. "nextSteps": An array of 3-4 specific, actionable recommendations for the brand to maximize results.

Focus on actionable insights. Be specific about video content elements that drive performance.

Return ONLY valid JSON, no markdown code blocks.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "You are an elite e-commerce analytics consultant specializing in video A/B testing and conversion optimization. Provide data-driven, actionable insights."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const aiAnalysis = JSON.parse(content);
      
      // Combine AI insights with calculated metrics
      const analysisResponse = {
        summary: aiAnalysis.summary || "Analysis complete.",
        winningVariantReasoning: aiAnalysis.winningVariantReasoning || "Unable to determine reasoning.",
        estimatedRevenueGrowth: aiAnalysis.estimatedRevenueGrowth || "N/A",
        nextSteps: aiAnalysis.nextSteps || ["Continue monitoring test performance"],
        metrics: metricsWithUplift,
        statisticalSignificance: significance.significant 
          ? `Statistically significant at ${significance.confidence}% confidence`
          : `Not yet significant (${significance.confidence}% confidence)`,
        confidence: significance.confidence
      };
      
      res.json(analysisResponse);
      
    } catch (error) {
      console.error("AI Analysis failed:", error);
      res.status(500).json({ message: "Failed to generate analysis" });
    }
  });

  return httpServer;
}
