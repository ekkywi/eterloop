export const TRADING_CONFIG = {
  FEE_PER_TRADE_PCT: 0.1,
  ROUND_TRIP_FEE_PCT: 0.2, // FEE * 2
  MIN_NET_PROFIT_PCT: 0.2,
  MIN_PRICE_MOVEMENT_PCT: 0.4, // ROUND_TRIP + MIN_NET

  // Stop Loss / Take Profit — nilai realistis untuk timeframe 15m di crypto
  STOP_LOSS_PCT: 1.5,    // 1.5% di bawah entry
  TAKE_PROFIT_PCT: 3.0,  // 3% di atas entry

  ALLOCATION_PCT: 0.05,
  MIN_TRADE_AMOUNT: 10.0,
} as const;
