import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IndicatorsService } from './indicators.service';

export interface RawCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CurrentFeatures {
  currentPrice: number;
  rsi: number | null;
  macd: { MACD: number; signal: number; histogram: number } | null;
  ema20?: number | null;
}

@Injectable()
export class FeatureExtractionService {
  private readonly logger = new Logger(FeatureExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly indicators: IndicatorsService,
  ) {}

  /**
   * FUNGSI UNTUK XGBOOST: Hanya menarik data mentah, komputasi dilakukan di Python.
   * Tarik 150 candle agar Python punya cukup data untuk menghitung MA/Bollinger Bands.
   */
  async getRawCandlesForML(symbol: string, limit: number = 150): Promise<RawCandle[]> {
    const candles = await this.prisma.db.candle.findMany({
      where: { symbol },
      orderBy: { timestamp: 'asc' }, // Harus ASC agar urutan waktu benar untuk Python
      take: limit,
    });

    if (candles.length < 50) {
      throw new Error(`Data historis tidak mencukupi untuk ${symbol}: ${candles.length} < 50`);
    }

    return candles.map(c => ({
      timestamp: Number(c.timestamp),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume),
    }));
  }

  async getCurrentFeatures(symbol: string): Promise<CurrentFeatures | null> {
    const candles = await this.prisma.db.candle.findMany({
      where: { symbol },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    if (candles.length < 35) return null;

    const closePrices = candles.reverse().map(c => Number(c.close));
    const macdResult = this.indicators.calculateMACD(closePrices);
    const macd = macdResult && macdResult.MACD !== undefined
      ? { MACD: macdResult.MACD, signal: macdResult.signal ?? 0, histogram: macdResult.histogram ?? 0 }
      : null;

    return {
      currentPrice: closePrices[closePrices.length - 1],
      rsi: this.indicators.calculateRSI(closePrices, 14),
      macd,
      ema20: this.indicators.calculateEMA(closePrices, 20),
    };
  }
}