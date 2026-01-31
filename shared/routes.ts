import { z } from 'zod';
import { insertTestSchema, tests, variants, analytics } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  tests: {
    list: {
      method: 'GET' as const,
      path: '/api/tests',
      responses: {
        200: z.array(z.custom<typeof tests.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/tests/:id',
      responses: {
        200: z.custom<typeof tests.$inferSelect & { variants: typeof variants.$inferSelect[] }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/tests',
      input: z.object({
        name: z.string(),
        productName: z.string(),
        targetPopulation: z.number(),
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
        variants: z.array(z.object({
          name: z.string(),
          videoUrl: z.string(),
          thumbnailUrl: z.string(),
          description: z.string().optional(),
        }))
      }),
      responses: {
        201: z.custom<typeof tests.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    analyze: {
      method: 'POST' as const,
      path: '/api/tests/:id/analyze',
      responses: {
        200: z.object({
          summary: z.string(),
          winningVariantReasoning: z.string(),
          estimatedRevenueGrowth: z.string(),
          nextSteps: z.array(z.string()),
          metrics: z.array(z.object({
            variantName: z.string(),
            conversionRate: z.number(),
            views: z.number(),
            conversions: z.number(),
            uplift: z.number().optional(),
          })),
          statisticalSignificance: z.string(),
          confidence: z.number(),
        }),
        404: errorSchemas.notFound,
        500: errorSchemas.internal,
      },
    },
    analytics: {
      method: 'GET' as const,
      path: '/api/tests/:id/analytics',
      input: z.object({
        timeRange: z.enum(['1h', '1d', '1w', '1m']).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof analytics.$inferSelect>()),
        404: errorSchemas.notFound,
      },
    },
    applyWinner: {
      method: 'POST' as const,
      path: '/api/tests/:id/apply-winner',
      input: z.object({
        winnerVariantId: z.number(),
      }),
      responses: {
        200: z.custom<typeof tests.$inferSelect>(),
        404: errorSchemas.notFound,
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
