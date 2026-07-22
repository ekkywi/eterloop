export interface MarketSignal {
    symbol: string;
    price: number;
    change24h: number;
    volume: number;
    mlSignal: 'BUY' | 'SELL' | 'HOLD'
    confidence: number;
}

export interface OpenPosition {
    id: string;
    symbol: string;
    entryPrice: number;
    currentPrice: number;
    invested: number;
    unrealizedPnlPct: number;
    createdAt: string;
}

export interface ExecutionLog {
    id: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    price: number;
    timestamp: string;
    metadata: Record<string, any>;
}