import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PredictionService } from '../../ml/prediction.service';
import { SignalEvaluationService } from '../signal/signal-evaluation.service';
import { MarketDataService } from '../market-data/market-data.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataService: MarketDataService,
    private readonly predictionService: PredictionService,
    private readonly signalEvaluationService: SignalEvaluationService,
  ) {}

  /**
   * RC-005 & AS-001: getOverview() sekarang membaca harga dari MarketDataService cache
   * (WebSocket miniTicker real-time), BUKAN dari REST API Binance (fetchTicker).
   * 
   * Ini menghilangkan risiko rate limit Binance dari dashboard polling frontend.
   */
  async getOverview() {
    const markets = await this.prisma.db.marketConfig.findMany({ where: { isActive: true } });

    const overview = await Promise.all(
      markets.map(async (market) => {
        // Baca harga dari cache WebSocket (instant, zero network call)
        const cachedTick = this.marketDataService.getCachedPrice(market.symbol);
        
        let price = 0;
        let change24h = 0;
        let volume = 0;

        if (cachedTick) {
          price = cachedTick.price;
          change24h = cachedTick.change24h;
          volume = Number((cachedTick.volume / 1000000).toFixed(2));
        } else {
          // Harga belum tersedia di cache (WebSocket baru connect atau market baru)
          this.logger.debug(`[Dashboard] Harga untuk ${market.symbol} belum tersedia di cache. Menampilkan 0.`);
        }

        let mlSignal = 'HOLD';
        let confidence = 0;

        try {
          const prediction = await this.predictionService.predictNextCandle(market.symbol);
          const displaySignal = this.signalEvaluationService.evaluateDisplaySignal({
            current_price: prediction.current_price,
            predicted_next_price: prediction.predicted_next_price,
          });
          mlSignal = displaySignal.signal;
          confidence = displaySignal.confidence;
        } catch (error: any) {
          this.logger.error(`Prediksi ML gagal untuk ${market.symbol}: ${error.message}`);
        }

        return {
          symbol: market.symbol,
          price,
          change24h,
          volume,
          mlSignal,
          confidence,
        };
      }),
    );

    return { data: overview };
  }

  async getSignalPreview(symbol: string) {
    const market = await this.prisma.db.marketConfig.findUnique({
      where: { symbol },
    });

    if (!market) {
      return { signal: 'HOLD', confidence: 0, reason: 'Market tidak ditemukan' };
    }

    const prediction = await this.predictionService.predictNextCandle(symbol);
    const displaySignal = this.signalEvaluationService.evaluateDisplaySignal({
      current_price: prediction.current_price,
      predicted_next_price: prediction.predicted_next_price,
    });

    const activePosition = await this.prisma.db.activePosition.findUnique({
      where: { symbol },
    });

    return {
      symbol,
      ...displaySignal,
      hasOpenPosition: !!activePosition,
      currentPrice: prediction.current_price,
    };
  }
}