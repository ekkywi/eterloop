'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { OpenPosition } from '../types';

const MOCK_POSITIONS: OpenPosition[] = [
  { 
    id: 'pos-001', symbol: 'SOL/USDT', type: 'LONG', 
    entryPrice: 142.50, currentPrice: 145.80, 
    margin: 500, leverage: 10, 
    unrealizedPnl: 115.78, pnlPercentage: 23.15 
  },
  { 
    id: 'pos-002', symbol: 'ETH/USDT', type: 'SHORT', 
    entryPrice: 3400.00, currentPrice: 3450.20, 
    margin: 1000, leverage: 5, 
    unrealizedPnl: -73.82, pnlPercentage: -7.38 
  },
];

export function OpenPositions() {
  if (MOCK_POSITIONS.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <span className="font-mono text-sm">NO ACTIVE POSITIONS</span>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto h-full">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 hover:bg-transparent">
            <TableHead className="font-mono text-xs uppercase tracking-wider">Symbol</TableHead>
            <TableHead className="font-mono text-xs uppercase tracking-wider text-right">Size / Lvg</TableHead>
            <TableHead className="font-mono text-xs uppercase tracking-wider text-right">Entry</TableHead>
            <TableHead className="font-mono text-xs uppercase tracking-wider text-right">Mark</TableHead>
            <TableHead className="font-mono text-xs uppercase tracking-wider text-right">ROE %</TableHead>
            <TableHead className="font-mono text-xs uppercase tracking-wider text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MOCK_POSITIONS.map((pos) => {
            const isProfit = pos.unrealizedPnl >= 0;
            return (
              <TableRow key={pos.id} className="border-border/50">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium font-mono text-sm">{pos.symbol}</span>
                    <span className={`font-mono text-[10px] uppercase tracking-wider ${pos.type === 'LONG' ? 'text-emerald-500' : 'text-destructive'}`}>
                      {pos.type}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col">
                    <span className="font-mono text-sm">${pos.margin}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{pos.leverage}x</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  ${pos.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span className={`font-mono text-sm font-bold ${isProfit ? 'text-emerald-500' : 'text-destructive'}`}>
                      {isProfit ? '+' : ''}{pos.unrealizedPnl.toFixed(2)}
                    </span>
                    <span className={`font-mono text-[10px] ${isProfit ? 'text-emerald-500' : 'text-destructive'}`}>
                      {isProfit ? '+' : ''}{pos.pnlPercentage.toFixed(2)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                    <button className="text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors">
                        Close
                    </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}