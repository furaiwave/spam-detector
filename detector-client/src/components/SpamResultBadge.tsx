// apps/frontend/src/components/SpamResultBadge.tsx
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SpamAnalysisResult, SpamLabel } from '@spam-detection/shared-types';
import { isThreat } from '@spam-detection/shared-types';

// satisfies — якщо додати новий SpamLabel, TS одразу зламає збірку
const LABEL_VARIANT = {
  spam:         'destructive',
  suspicious:   'outline',
  needs_review: 'secondary',
  not_spam:     'default',
} as const satisfies Record<SpamLabel, string>;

const LABEL_ICON: Record<SpamLabel, string> = {
  spam:         '🚨',
  suspicious:   '⚠️',
  needs_review: '👁',
  not_spam:     '✅',
};

const LABEL_TEXT: Record<SpamLabel, string> = {
  spam:         'Спам',
  suspicious:   'Підозрілий',
  needs_review: 'Потребує перевірки',
  not_spam:     'Чистий',
};

const SEVERITY_TEXT: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low:      'низька',
  medium:   'середня',
  high:     'висока',
  critical: 'критична',
};

type Props =
  | { result: SpamAnalysisResult; showDetails?: boolean; compact?: false }
  | { result: SpamAnalysisResult; compact: true; showDetails?: never };

export function SpamResultBadge({ result, showDetails, compact }: Props) {
  const badge = (
    <Badge variant={LABEL_VARIANT[result.label]} className="gap-1 text-sm">
      <span>{LABEL_ICON[result.label]}</span>
      <span>{LABEL_TEXT[result.label]}</span>
      {!compact && (
        <span className="opacity-70">
          {(result.confidence * 100).toFixed(0)}%
        </span>
      )}
    </Badge>
  );

  if (!showDetails || !isThreat(result)) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="space-y-1">
        <p className="font-semibold">Серйозність: {SEVERITY_TEXT[result.severity]}</p>
        {result.reasons.length > 0 && (
          <ul className="text-xs list-disc list-inside">
            {result.reasons.map(r => <li key={r}>{r}</li>)}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
}