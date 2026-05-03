// apps/frontend/src/hooks/useApiQuery.ts
import { useState, useCallback, useRef } from 'react';
import type { ApiSuccess, ApiError } from '@spam-detection/shared-types';
import { isSuccess } from '@/lib/api-client';

// Стан запиту — discriminated union
export type QueryState<TData> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: TData; readonly timestamp: number }
  | { readonly status: 'error';   readonly error: ApiError['error'] };

// infer TData із TResponse — не треба передавати окремо
export function useApiQuery<TResponse extends ApiSuccess<unknown>>(
  fetcher: () => Promise<TResponse | ApiError>,
) {
  type TData = TResponse extends ApiSuccess<infer D> ? D : never;

  const [state, setState] = useState<QueryState<TData>>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState({ status: 'loading' });

    const res = await fetcher();

    if (isSuccess(res)) {
      setState({
        status:    'success',
        data:      res.data as TData,
        timestamp: Date.now(),
      });
    } else {
      setState({ status: 'error', error: res.error });
    }
  }, [fetcher]);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, execute, reset } as const;
}

// ── Mutation variant (для POST) ────────────────────────────────────────────
export function useApiMutation<TPayload, TResponse extends ApiSuccess<unknown>>(
  mutator: (payload: TPayload) => Promise<TResponse | ApiError>,
) {
  type TData = TResponse extends ApiSuccess<infer D> ? D : never;

  const [state, setState] = useState<QueryState<TData>>({ status: 'idle' });

  const mutate = useCallback(async (payload: TPayload) => {
    setState({ status: 'loading' });
    const res = await mutator(payload);
    if (isSuccess(res)) {
      setState({ status: 'success', data: res.data as TData, timestamp: Date.now() });
    } else {
      setState({ status: 'error', error: res.error });
    }
    return res;
  }, [mutator]);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, mutate, reset } as const;
}