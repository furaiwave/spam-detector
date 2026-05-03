// apps/frontend/src/components/StatsPanel.tsx
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSpamStats } from '@/hooks/useSpam';
import type { SpamLabel } from '@spam-detection/shared-types';

const LABEL_COLOR: Record<SpamLabel, string> = {
  spam:         'bg-destructive',
  suspicious:   'bg-yellow-500',
  needs_review: 'bg-blue-400',
  not_spam:     'bg-green-500',
};

const LABEL_TEXT: Record<SpamLabel, string> = {
  spam:         'Спам',
  suspicious:   'Підозрілий',
  needs_review: 'Потребує перевірки',
  not_spam:     'Чистий',
};

interface StatsPanelProps {
  readonly refreshKey?: number;
}

export function StatsPanel({ refreshKey = 0 }: StatsPanelProps = {}) {
  const { state, execute } = useSpamStats();

  useEffect(() => { execute(); }, [execute, refreshKey]);

  const refreshBtn = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => execute()}
      disabled={state.status === 'loading'}
      aria-label="Оновити"
    >
      <RefreshCw className={`h-4 w-4 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
    </Button>
  );

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <Skeleton className="h-6 w-40" />
          {refreshBtn}
        </CardHeader>
        <CardContent className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-8" />)}
        </CardContent>
      </Card>
    );
  }

  if (state.status === 'error') {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-destructive">Помилка</CardTitle>
          {refreshBtn}
        </CardHeader>
        <CardContent className="text-destructive text-sm">{state.error.message}</CardContent>
      </Card>
    );
  }

  const { data } = state;
  const entries = Object.entries(data.byLabel) as [SpamLabel, number][];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>
          Статистика — <span className="font-mono">{data.total}</span> публікацій
        </CardTitle>
        {refreshBtn}
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map(([label, count]) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{LABEL_TEXT[label]}</span>
              <span className="font-mono text-muted-foreground">
                {count} ({((count / (data.total || 1)) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${LABEL_COLOR[label]}`}
                style={{ width: `${(count / (data.total || 1)) * 100}%` }}
              />
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-2">
          Середня впевненість:{' '}
          <span className="font-mono font-semibold">
            {(data.avgConfidence * 100).toFixed(1)}%
          </span>
        </p>
      </CardContent>
    </Card>
  );
}