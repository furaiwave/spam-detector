// apps/frontend/src/lib/api-client.ts
import type {
  ApiSuccess, ApiError,
  AnalyzePostRequest, AnalyzePostResponse,
  GetAnalysisResponse, GetHistoryResponse,
  GetStatsResponse, TrainResponse,
  AnalysisId, ISOTimestamp,
} from '@spam-detection/shared-types';

const BASE = '/api/v1/spam';

async function request<TResponse extends ApiSuccess<unknown>>(
  url:     string,
  options?: RequestInit,
): Promise<TResponse | ApiError> {
  try {
    const res  = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    // unknown тут необхідний — fetch не знає наш тип
    const json: unknown = await res.json();
    return json as TResponse | ApiError;
  } catch {
    return {
      success: false,
      error: {
        code:    'ML_SERVICE_UNAVAILABLE',
        message: 'Network error — check your connection',
        details: [],
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString() as ISOTimestamp,
        version:   '1.0.0',
      },
    } satisfies ApiError;
  }
}

// ── Typed API methods — кожен знає свій response shape ────────────────────
export const apiClient = {
  analyze: (payload: AnalyzePostRequest) =>
    request<AnalyzePostResponse>(BASE + '/analyze', {
      method: 'POST',
      body:   JSON.stringify(payload),
    }),

  getAnalysis: (id: AnalysisId) =>
    request<GetAnalysisResponse>(`${BASE}/${id}`),

  getHistory: (params: { userId: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams({
      userId:   params.userId,
      page:     String(params.page     ?? 1),
      pageSize: String(params.pageSize ?? 20),
    });
    return request<GetHistoryResponse>(`${BASE}/history?${q}`);
  },

  getStats: (from: string, to: string) =>
    request<GetStatsResponse>(`${BASE}/stats?from=${from}&to=${to}`),

  train: async (file: File): Promise<TrainResponse | ApiError> => {
    const form = new FormData();
    form.append('file', file);
    try {
      const res  = await fetch(`${BASE}/train`, { method: 'POST', body: form });
      const json: unknown = await res.json();
      return json as TrainResponse | ApiError;
    } catch {
      return {
        success: false,
        error: {
          code:    'ML_SERVICE_UNAVAILABLE',
          message: 'Network error — check your connection',
          details: [],
        },
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString() as ISOTimestamp,
          version:   '1.0.0',
        },
      } satisfies ApiError;
    }
  },
} as const;

// Утиліта — звужує union до success варіанту
export function isSuccess<T extends ApiSuccess<unknown>>(
  res: T | ApiError,
): res is T {
  return res.success === true;
}