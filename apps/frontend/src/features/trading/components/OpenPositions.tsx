'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePositions } from '../hooks/use-positions';
import { useClosePosition } from '../hooks/use-close-position';
import { formatPrice, formatPct } from '@/lib/utils';

export function OpenPositions() {
  const { data: positions, isLoading, isError } = usePositions();
  const { mutate: closePos, isPending } = useClosePosition();

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <span className="font-mono text-sm">LOADING...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-destructive">
        <span className="font-mono text-sm">GAGAL MEMUAT POSISI</span>
      </div>
    );
  }

  if (!positions || positions.length === 0) {
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
            <TableHead className="font-mono text-xs uppercase tracking-wider text-right">Entry</TableHead>
            <TableHead className="font-mono text-xs uppercase tracking-wider text-right">Mark</TableHead>
            <TableHead className="font-mono text-xs uppercase tracking-wider text-right">Invested</TableHead>
            <TableHead className="font-mono text-xs uppercase tracking-wider text-right">PnL %</TableHead>
            <TableHead className="font-mono text-xs uppercase tracking-wider text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((pos) => {
            const isProfit = pos.unrealizedPnlPct >= 0;
            return (
              <TableRow key={pos.id} className="border-border/50">
                <TableCell>
                  <span className="font-medium font-mono text-sm">{pos.symbol}</span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  ${formatPrice(Number(pos.entryPrice))}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  ${formatPrice(pos.currentPrice)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  ${pos.invested.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={`font-mono text-sm font-bold ${isProfit ? 'text-emerald-500' : 'text-destructive'}`}>
                    {formatPct(pos.unrealizedPnlPct)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <button 
                    onClick={() => closePos(pos.symbol)}
                    disabled={isPending}
                    className="text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? 'CLOSING...' : 'CLOSE'}
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