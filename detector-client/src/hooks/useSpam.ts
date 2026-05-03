// apps/frontend/src/hooks/useSpam.ts
import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useApiMutation, useApiQuery } from './useApiQuery';
import type { AnalyzePostRequest } from '@spam-detection/shared-types';

export function useAnalyze() {
  const { state, mutate, reset } = useApiMutation(
    (payload: AnalyzePostRequest) => apiClient.analyze(payload),
  );
  return { state, analyze: mutate, reset } as const;
}

export function useSpamStats() {
  const fetcher = useCallback(async () => {
    const now  = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const to   = now.toISOString();
    console.log('[useSpamStats] fetching', { from, to });
    const res = await apiClient.getStats(from, to);
    console.log('[useSpamStats] response', res);
    return res;
  }, []);
  return useApiQuery(fetcher);
}

export function useHistory(userId: string, page = 1) {
  const fetcher = useCallback(
    () => apiClient.getHistory({ userId, page }),
    [userId, page],
  );
  return useApiQuery(fetcher);
}