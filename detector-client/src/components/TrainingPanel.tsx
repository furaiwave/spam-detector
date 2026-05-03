import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient, isSuccess } from '@/lib/api-client';
import type { TrainData } from '@spam-detection/shared-types';

type State =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: TrainData }
  | { readonly status: 'error'; readonly message: string };

export function TrainingPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>({ status: 'idle' });

  const submit = async () => {
    if (!file) return;
    setState({ status: 'loading' });
    const res = await apiClient.train(file);
    if (isSuccess(res)) {
      setState({ status: 'success', data: res.data });
    } else {
      setState({ status: 'error', message: res.error.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Тренування моделі
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain,*/*"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            disabled={state.status === 'loading'}
          />
          <p className="text-xs text-muted-foreground mt-2">
            CSV або TSV з колонками <code>text</code>/<code>label</code> (або алиаси <code>v2</code>/<code>v1</code>,
            <code>message</code>/<code>class</code>). Підтримує мітки <code>ham</code>/<code>spam</code> і{' '}
            <code>0</code>/<code>1</code> — авто-конвертяться. Працює з UCI SMS Spam Collection без перетворень.
          </p>
        </div>
        <Button
          onClick={submit}
          disabled={!file || state.status === 'loading'}
          className="w-full"
        >
          {state.status === 'loading' && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {state.status === 'loading' ? 'Тренування… (може зайняти кілька хвилин)' : 'Тренувати'}
        </Button>

        {state.status === 'success' && (
          <div className="rounded-lg border p-3 bg-muted/50 text-sm space-y-1">
            <p>
              Зразків: <span className="font-mono font-semibold">{state.data.samples}</span>
            </p>
            <p>
              Точність на test:{' '}
              <span className="font-mono font-semibold">
                {(state.data.test_accuracy * 100).toFixed(1)}%
              </span>
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Розподіл:{' '}
              {Object.entries(state.data.label_counts)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')}
            </p>
          </div>
        )}

        {state.status === 'error' && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
