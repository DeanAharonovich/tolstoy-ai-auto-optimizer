import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { CreateTestRequest } from "@shared/schema";
import { z } from "zod";

// Fetch all tests
export function useTests() {
  return useQuery({
    queryKey: [api.tests.list.path],
    queryFn: async () => {
      const res = await fetch(api.tests.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tests");
      return api.tests.list.responses[200].parse(await res.json());
    },
  });
}

// Fetch single test with variants
export function useTest(id: number) {
  return useQuery({
    queryKey: [api.tests.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.tests.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch test details");
      return api.tests.get.responses[200].parse(await res.json());
    },
    enabled: !!id && !isNaN(id),
  });
}

// Fetch analytics for a test
export function useTestAnalytics(id: number, timeRange?: '1h' | '1d' | '1w' | '1m') {
  return useQuery({
    queryKey: [api.tests.analytics.path, id, timeRange],
    queryFn: async () => {
      const path = buildUrl(api.tests.analytics.path, { id });
      const url = timeRange ? `${path}?timeRange=${timeRange}` : path;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return api.tests.analytics.responses[200].parse(await res.json());
    },
    enabled: !!id && !isNaN(id),
  });
}

// Create a new test
export function useCreateTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTestRequest) => {
      const res = await fetch(api.tests.create.path, {
        method: api.tests.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.tests.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create test");
      }
      return api.tests.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tests.list.path] });
    },
  });
}

// Analyze test results (AI generation)
export function useAnalyzeTest() {
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.tests.analyze.path, { id });
      const res = await fetch(url, {
        method: api.tests.analyze.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate analysis");
      return api.tests.analyze.responses[200].parse(await res.json());
    },
  });
}

// Apply winner to a test
export function useApplyWinner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ testId, winnerVariantId }: { testId: number; winnerVariantId: number }) => {
      const url = buildUrl(api.tests.applyWinner.path, { id: testId });
      const res = await fetch(url, {
        method: api.tests.applyWinner.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerVariantId }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to apply winner");
      }
      return api.tests.applyWinner.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.tests.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.tests.get.path, variables.testId] });
    },
  });
}
