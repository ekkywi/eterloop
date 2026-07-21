'use client';

import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketIntelligence } from '@/features/trading/components/MarketIntelligence';
import { OpenPositions } from '@/features/trading/components/OpenPositions';
import { ExecutionLogs } from '@/features/trading/components/ExecutionLogs';

export default function DashboardPage() {
  const { isLiveMode } = useAppStore();

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight font-mono">
          Terminal {isLiveMode ? 'Live' : 'Simulation'}
        </h2>
      </div>

      {/* Grid Utama */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Modul 1: ML Market Signals */}
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground uppercase tracking-wider">
              Market Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MarketIntelligence />
          </CardContent>
        </Card>

        {/* Modul 2: Active Positions */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground uppercase tracking-wider">
              Open Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OpenPositions />
          </CardContent>
        </Card>

      </div>

      {/* Grid Sekunder */}
      <div className="grid gap-4 grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground uppercase tracking-wider">
              Engine Execution Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExecutionLogs />
          </CardContent>
        </Card>
      </div>

    </div>
  );
}