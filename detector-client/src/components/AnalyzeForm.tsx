// apps/frontend/src/components/AnalyzeForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SpamResultBadge } from '@/components/SpamResultBadge';
import { useAnalyze } from '@/hooks/useSpam';
import type { Platform, Language } from '@spam-detection/shared-types';

// Локальна Zod schema для форми — окрема від shared DTO
// (форма не має postId/userId — вони генеруються)
const FormSchema = z.object({
  content:  z.string().min(1, 'Введіть зміст публікації').max(10_000),
  platform: z.enum(['twitter', 'facebook', 'instagram', 'telegram', 'reddit', 'bluesky'] as const),
  language: z.enum(['uk', 'en', 'de', 'fr', 'pl'] as const),
});

const LANGUAGE_LABEL: Record<Language, string> = {
  uk: 'Українська',
  en: 'Англійська',
  de: 'Німецька',
  fr: 'Французька',
  pl: 'Польська',
};

type FormValues = z.infer<typeof FormSchema>;

const PLATFORMS: Platform[] = ['twitter', 'facebook', 'instagram', 'telegram', 'reddit', 'bluesky'];

const PLATFORM_LABEL: Record<Platform, string> = {
  twitter:   'Twitter / X',
  facebook:  'Facebook',
  instagram: 'Instagram',
  telegram:  'Telegram',
  reddit:    'Reddit',
  bluesky:   'Bluesky',
};
const LANGUAGES: Language[] = ['uk', 'en', 'de', 'fr', 'pl'];

interface AnalyzeFormProps {
  readonly onAnalyzed?: () => void;
}

export function AnalyzeForm({ onAnalyzed }: AnalyzeFormProps = {}) {
  const { state, analyze, reset } = useAnalyze();

  const form = useForm<FormValues>({
    resolver:      zodResolver(FormSchema),
    defaultValues: { language: 'en', platform: 'twitter' },
  });

  const onSubmit = async (values: FormValues) => {
    reset();
    const res = await analyze({
      postId:   crypto.randomUUID(),   // demo: generate on client
      userId:   'demo-user',
      content:  values.content,
      platform: values.platform,
      language: values.language,
    });
    if (res.success) onAnalyzed?.();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Виявлення спаму
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Зміст публікації</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Вставте текст для аналізу..."
                      className="min-h-[120px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Платформа</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PLATFORMS.map(p => (
                          <SelectItem key={p} value={p}>
                            {PLATFORM_LABEL[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Мова</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LANGUAGES.map(l => (
                          <SelectItem key={l} value={l}>{LANGUAGE_LABEL[l]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={state.status === 'loading'}
            >
              {state.status === 'loading' && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Аналізувати
            </Button>

            {state.status === 'success' && (
              <div className="flex items-center gap-3 rounded-lg border p-4 bg-muted/50">
                <SpamResultBadge result={state.data.result} showDetails />
                <p className="text-sm text-muted-foreground font-mono truncate">
                  {state.data.analysisId}
                </p>
              </div>
            )}

            {state.status === 'error' && (
              <Alert variant="destructive">
                <AlertDescription>{state.error.message}</AlertDescription>
              </Alert>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}