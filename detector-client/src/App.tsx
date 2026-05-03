// apps/frontend/src/App.tsx
import { useState } from 'react';
import { AnalyzeForm }   from '@/components/AnalyzeForm';
import { StatsPanel }    from '@/components/StatsPanel';
import { TrainingPanel } from '@/components/TrainingPanel';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function App() {
  const [statsKey, setStatsKey] = useState(0);
  const refreshStats = () => setStatsKey(k => k + 1);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b px-6 py-4">
          <h1 className="text-xl font-bold tracking-tight">
            🛡 Система виявлення спаму
          </h1>
          <p className="text-sm text-muted-foreground">
            Аналіз контенту соцмереж на основі ШІ
          </p>
        </header>

        <main className="container mx-auto px-4 py-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <AnalyzeForm onAnalyzed={refreshStats} />
            <TrainingPanel />
          </div>
          <StatsPanel refreshKey={statsKey} />
        </main>
      </div>
    </TooltipProvider>
  );
}