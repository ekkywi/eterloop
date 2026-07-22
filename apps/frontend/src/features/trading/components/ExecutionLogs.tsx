'use client';

import { useTradeHistory } from '../hooks/use-trade-history';

export function ExecutionLogs() {
  const { data: logs, isLoading, isError } = useTradeHistory();

  if (isLoading) {
    return (
      <div className="w-full h-full overflow-auto bg-black/20 rounded p-4 border border-border/50">
        <div className="flex items-center justify-center h-full">
          <span className="font-mono text-xs text-muted-foreground">LOADING LOGS...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full h-full overflow-auto bg-black/20 rounded p-4 border border-border/50">
        <div className="flex items-center justify-center h-full">
          <span className="font-mono text-xs text-destructive">GAGAL MEMUAT LOG</span>
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="w-full h-full overflow-auto bg-black/20 rounded p-4 border border-border/50">
        <div className="flex items-center justify-center h-full">
          <span className="font-mono text-xs text-muted-foreground">NO TRADE LOGS YET</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto bg-black/20 rounded p-4 border border-border/50">
      <div className="flex flex-col space-y-2 font-mono text-xs">
        {logs.map((log) => {
          const time = new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false });
          const isBuy = log.action === 'BUY';
          const grossPnL = log.metadata?.grossPnL;
          const netPnl = log.metadata?.netPnL;
          const netProfitUsdt = log.metadata?.netProfitUsdt;
          const trigger = log.metadata?.trigger;
          const reason = log.metadata?.reason;

          let level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO';
          let message = '';

          if (isBuy) {
            level = 'SUCCESS';
            message = `BUY ${log.symbol} @ $${log.price.toFixed(2)} | Invested: $${log.metadata?.tradeAmount?.toFixed(2)}`;
          } else {
            const netPnlNum = typeof netPnl === 'number' ? netPnl : 0;
            if (trigger === 'CUT LOSS') {
              level = 'ERROR';
              message = `CLOSE ${log.symbol} @ $${log.price.toFixed(2)} | CUT LOSS | Net PnL: ${netPnlNum.toFixed(2)}%`;
            } else if (trigger === 'TAKE PROFIT') {
              level = 'SUCCESS';
              message = `CLOSE ${log.symbol} @ $${log.price.toFixed(2)} | TAKE PROFIT | Net PnL: ${netPnlNum.toFixed(2)}%`;
            } else {
              level = netPnlNum >= 0 ? 'SUCCESS' : 'WARN';
              message = `CLOSE ${log.symbol} @ $${log.price.toFixed(2)} | Net PnL: ${netPnlNum.toFixed(2)}% ($${typeof netProfitUsdt === 'number' ? netProfitUsdt.toFixed(2) : '0.00'})`;
            }
          }

          let colorClass = 'text-muted-foreground';
          if (level === 'SUCCESS') colorClass = 'text-emerald-500';
          if (level === 'WARN') colorClass = 'text-yellow-500';
          if (level === 'ERROR') colorClass = 'text-destructive';

          return (
            <div key={log.id} className="flex gap-4">
              <span className="text-muted-foreground opacity-50">[{time}]</span>
              <span className={`${colorClass} font-bold w-20`}>{level}</span>
              <span className="text-foreground">{message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}