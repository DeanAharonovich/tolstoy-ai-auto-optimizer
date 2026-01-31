export interface MockTestData {
  name: string;
  productName: string;
  targetPopulation: number;
  startTime: Date;
  endTime: Date;
  status: string;
  conversionUplift: string;
  incomeUplift: string;
  totalGain: string;
  isMock: boolean;
  variants: {
    name: string;
    videoUrl: string;
    thumbnailUrl: string;
    description: string;
  }[];
}

export const DEMO_TEST: MockTestData = {
  name: "Homepage Hero Video A/B Test",
  productName: "Summer Collection 2024",
  targetPopulation: 25000,
  startTime: new Date(),
  endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  status: "running",
  conversionUplift: "+24.5%",
  incomeUplift: "+$12,840",
  totalGain: "+31%",
  isMock: true,
  variants: [
    {
      name: "Variant A - Lifestyle Focus",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      thumbnailUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60",
      description: "Showcases products in everyday lifestyle scenarios with ambient music and casual pacing"
    },
    {
      name: "Variant B - Product Detail",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      thumbnailUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60",
      description: "Close-up product shots with feature callouts and energetic background music"
    },
    {
      name: "Variant C - Customer Testimonial",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
      thumbnailUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=60",
      description: "Real customer reviews and unboxing reactions with authentic social proof"
    }
  ]
};

export function generateMockAnalytics(
  testId: number,
  variantIds: number[],
  daysOfData: number = 30
): {
  testId: number;
  variantId: number;
  timestamp: Date;
  views: number;
  conversions: number;
  interactions: number;
}[] {
  const now = new Date();
  const analyticsData: {
    testId: number;
    variantId: number;
    timestamp: Date;
    views: number;
    conversions: number;
    interactions: number;
  }[] = [];

  const totalPoints = daysOfData * 24 * 4;

  const variantCumulatives = variantIds.map((_, idx) => ({
    views: 0,
    conversions: 0,
    interactions: 0,
    growthRate: 1 + (idx * 0.15),
    conversionRate: 0.025 + (idx * 0.008)
  }));

  for (let i = 0; i < totalPoints; i++) {
    const timestamp = new Date(now.getTime() - (totalPoints - i) * 15 * 60 * 1000);
    const progress = i / totalPoints;

    const hour = timestamp.getHours();
    const dayMultiplier = (hour >= 9 && hour <= 21) ? 1.5 : 0.5;
    const noise = () => 1 + (Math.random() - 0.5) * 0.4;

    variantIds.forEach((variantId, idx) => {
      const cumulative = variantCumulatives[idx];

      const viewsIncrement = Math.floor(3 * dayMultiplier * noise() * cumulative.growthRate * (0.8 + progress * 0.4));
      const conversionsIncrement = Math.random() < cumulative.conversionRate * dayMultiplier ? 1 : 0;
      const interactionsIncrement = Math.floor(viewsIncrement * (0.08 + idx * 0.02) * noise());

      cumulative.views += viewsIncrement;
      cumulative.conversions += conversionsIncrement;
      cumulative.interactions += interactionsIncrement;

      analyticsData.push({
        testId,
        variantId,
        timestamp,
        views: cumulative.views,
        conversions: cumulative.conversions,
        interactions: cumulative.interactions,
      });
    });
  }

  return analyticsData;
}
