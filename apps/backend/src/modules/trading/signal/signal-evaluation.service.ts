import { Injectable } from '@nestjs/common';
import { TRADING_CONFIG } from '../config/trading.config';

interface MlPrediction {
  current_price: number;
  predicted_next_price: number;
}

interface DisplaySignal {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  priceChangePct: number;
}

interface ExecutionContext {
  hasOpenPosition: boolean;
  walletBalance: number;
  quoteAsset: string;
}

interface ExecutionDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
  priceChangePct: number;
  tradeAmount?: number;
  stopLoss?: number;
  takeProfit?: number;
}

@Injectable()
export class SignalEvaluationService {
  /**
   * Pure function: Hitung persentase perubahan harga dari prediksi ML
   */
  computePriceChangePct(prediction: MlPrediction): number {
    if (!prediction.current_price || !prediction.predicted_next_price) {
      return 0;
    }
    return ((prediction.predicted_next_price - prediction.current_price) / prediction.current_price) * 100;
  }

  /**
   * Pure function: Evaluasi sinyal untuk ditampilkan di dashboard (read-only)
   * Tidak perlu cek wallet/posisi — hanya threshold
   */
  evaluateDisplaySignal(prediction: MlPrediction): DisplaySignal {
    const priceChangePct = this.computePriceChangePct(prediction);
    const threshold = TRADING_CONFIG.MIN_PRICE_MOVEMENT_PCT;

    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (priceChangePct > threshold) signal = 'BUY';
    else if (priceChangePct < -threshold) signal = 'SELL';

    return {
      signal,
      confidence: Math.abs(Number(priceChangePct.toFixed(2))),
      priceChangePct: Number(priceChangePct.toFixed(2)),
    };
  }

  /**
   * Pure function: Evaluasi sinyal untuk eksekusi trading (mutating)
   * Cek wallet balance dan posisi yang sudah terbuka
   */
  evaluateExecutionDecision(
    prediction: MlPrediction,
    context: ExecutionContext,
  ): ExecutionDecision {
    const priceChangePct = this.computePriceChangePct(prediction);
    const currentPrice = prediction.current_price;
    const threshold = TRADING_CONFIG.MIN_PRICE_MOVEMENT_PCT;

    // CASE 1: Prediksi bullish signifikan
    if (priceChangePct > threshold) {
      if (context.hasOpenPosition) {
        return {
          action: 'HOLD',
          reason: `Sinyal NAIK (${priceChangePct.toFixed(2)}%), posisi sudah terbuka. Biarkan profit berjalan.`,
          priceChangePct,
        };
      }

      // Hitung trade amount
      let tradeAmount = context.walletBalance * TRADING_CONFIG.ALLOCATION_PCT;
      if (tradeAmount < TRADING_CONFIG.MIN_TRADE_AMOUNT) {
        tradeAmount = TRADING_CONFIG.MIN_TRADE_AMOUNT;
      }

      if (context.walletBalance < tradeAmount) {
        return {
          action: 'HOLD',
          reason: `Prediksi NAIK, tapi Saldo ${context.quoteAsset} (${context.walletBalance.toFixed(2)}) tidak cukup untuk minimum trade ($${tradeAmount.toFixed(2)}).`,
          priceChangePct,
        };
      }

      return {
        action: 'BUY',
        reason: `Prediksi naik ${priceChangePct.toFixed(2)}%. Position Size: $${tradeAmount.toFixed(2)}. Buka posisi.`,
        priceChangePct,
        tradeAmount,
        stopLoss: currentPrice * (1 - TRADING_CONFIG.STOP_LOSS_PCT),
        takeProfit: currentPrice * (1 + TRADING_CONFIG.TAKE_PROFIT_PCT),
      };
    }

    // CASE 2: Prediksi bearish signifikan
    if (priceChangePct < -threshold) {
      if (!context.hasOpenPosition) {
        return {
          action: 'HOLD',
          reason: `Sinyal TURUN (${priceChangePct.toFixed(2)}%), posisi kosong. Abaikan.`,
          priceChangePct,
        };
      }

      return {
        action: 'SELL',
        reason: `Sinyal TURUN (${priceChangePct.toFixed(2)}%). Tutup posisi!`,
        priceChangePct,
      };
    }

    // CASE 3: Pergerakan tidak signifikan
    return {
      action: 'HOLD',
      reason: `Pergerakan (${priceChangePct.toFixed(2)}%) tidak menutupi round-trip fee (${TRADING_CONFIG.ROUND_TRIP_FEE_PCT}%) dan target profit.`,
      priceChangePct,
    };
  }
}