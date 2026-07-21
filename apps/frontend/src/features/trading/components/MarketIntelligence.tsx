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
import { useMarketSignals } from '../hooks/use-market-signals';

export function MarketIntelligence() {
  const { data: signals, isLoading, isError, dataUpdatedAt } = useMarketSignals();

  const lastUpdated = dataUpdatedAt 
    ? new Date(dataUpdatedAt).toLocaleTimeString() 
    : 'Waiting for data...';

  if (isLoading) {
    return <div className="p-4 text-sm font-mono text-muted-foreground">Connecting to Engine...</div>;
  }

  if (isError) {
    return <div className="p-4 text-sm font-mono text-destructive">ERROR: Failed to fetch market data.</div>;
  }

  const displayData = signals || [];

  return (
    <div className="flex flex-col h-full">
      <div className="w-full overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="font-mono text-xs uppercase tracking-wider">Asset</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider text-right">Price</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider text-right">24h (%)</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider text-right">Vol (M)</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider text-center">ML Signal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((asset) => (
              <TableRow key={asset.symbol} className="border-border/50">
                <TableCell className="font-medium font-mono text-sm">{asset.symbol}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className={`text-right font-mono text-sm ${asset.change24h >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                  {asset.change24h > 0 ? '+' : ''}{asset.change24h}%
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {asset.volume}M
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant="outline" 
                    className={`font-mono text-[10px] uppercase tracking-widest ${
                      asset.mlSignal === 'BUY' ? 'border-emerald-500/50 text-emerald-500' : 
                      asset.mlSignal === 'SELL' ? 'border-destructive/50 text-destructive' : 
                      'border-muted-foreground/50 text-muted-foreground'
                    }`}
                  >
                    {asset.mlSignal} ({asset.confidence}%)
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="mt-2 text-right">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Last sync: {lastUpdated}
        </span>
      </div>
    </div>
  );
}