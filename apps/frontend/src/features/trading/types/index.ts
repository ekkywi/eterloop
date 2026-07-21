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
    type: 'LONG' | 'SHORT';
    entryPrice: number;
    currentPrice: number;
    margin: number;
    leverage: number;
    unrealizedPnl: number;
    pnlPercentage: number;
  }

  export interface ExecutionLog {
    id: string;
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
    message: string;
  }