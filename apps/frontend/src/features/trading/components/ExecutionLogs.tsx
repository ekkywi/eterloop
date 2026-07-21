'use client';

import { ExecutionLog } from '../types';

const MOCK_LOGS: ExecutionLog[] = [
  { id: 'log-1', timestamp: '14:38:02', level: 'INFO', message: 'Engine started. Listening to market data...' },
  { id: 'log-2', timestamp: '14:39:15', level: 'SUCCESS', message: 'Executed LONG order for SOL/USDT at $142.50' },
  { id: 'log-3', timestamp: '14:40:01', level: 'WARN', message: 'High volatility detected on ETH/USDT. Tightening stop-loss.' },
];

export function ExecutionLogs() {
  return (
    <div className="w-full h-full overflow-auto bg-black/20 rounded p-4 border border-border/50">
      <div className="flex flex-col space-y-2 font-mono text-xs">
        {MOCK_LOGS.map((log) => {
          let colorClass = 'text-muted-foreground';
          if (log.level === 'SUCCESS') colorClass = 'text-emerald-500';
          if (log.level === 'WARN') colorClass = 'text-yellow-500';
          if (log.level === 'ERROR') colorClass = 'text-destructive';

          return (
            <div key={log.id} className="flex gap-4">
              <span className="text-muted-foreground opacity-50">[{log.timestamp}]</span>
              <span className={`${colorClass} font-bold w-16`}>{log.level}</span>
              <span className="text-foreground">{log.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}