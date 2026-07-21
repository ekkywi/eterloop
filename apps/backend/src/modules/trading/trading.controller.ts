import { Controller, Get, Post, Body, Query, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DecisionService } from './decision/decision.service';
import { PrismaService } from '../database/prisma.service';
import { CandlesService } from '../candles/candles.service';
import { ExchangeService } from '../candles/exchange.service';
import { PredictionService } from '../ml/prediction.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { SignalQueryDto } from './dto/signal-query.dto';

@ApiTags('Trading')
@Controller('api/trading')
export class TradingController {
  private readonly logger = new Logger(TradingController.name);

  constructor(
    private readonly decisionService: DecisionService,
    private readonly prisma: PrismaService,
    private readonly candleService: CandlesService,
    private readonly exchangeService: ExchangeService,
    private readonly predictionService: PredictionService
  ) {}

  @Get('signal')
  @ApiOperation({ summary: 'Mendapatkan sinyal trading (BUY/SELL/HOLD) berdasarkan predikisi ML' })
  async getSignal(@Query() query: SignalQueryDto) {
    if (!query.symbol) {
      throw new BadRequestException('Parameter symbol wajib disertakan');
    }
    return this.decisionService.evaluateSignal(query.symbol);
  }

  @Get('market')
  @ApiOperation({ summary: 'Melihat daftar koin yang sedang dipantau oleh bot' })
  async getMarket() {
    return this.prisma.db.marketConfig.findMany();
  }

  @Post('market')
  @ApiOperation({ summary: 'Menambah koin baru untuk dipantau oleh bot' })
  async addMarket(@Body() dto: CreateMarketDto) {
    if (!dto.symbol) {
      throw new BadRequestException('Parameter symbol wajib diisi (contoh: BTC/USDT)');
    }

    const uppercaseSymbol = dto.symbol.toUpperCase();
    const timeframe = dto.timeframe || '15m';

    try {
      const newMarket = await this.prisma.db.marketConfig.create({
        data: {
          symbol: uppercaseSymbol,
          isActive: true,
          timeframe: timeframe
        }
      });

      this.candleService.syncCandles(uppercaseSymbol, timeframe, 1000)
        .then(res => this.logger.log(`[Auto-Backfill] Sukses menarik ${res.inserted} candle untuk ${uppercaseSymbol}`))
        .catch(err => this.logger.error(`[Auto-Backfill] Gagal untuk ${uppercaseSymbol}:`, err.message));

        return {
          message: 'Koin berhasil ditambahkan ke Registry dan proses backfill sedang berjalan di latar belakang.',
          data: newMarket
        };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new HttpException('Koin ini sudah terdaftar di database', HttpStatus.CONFLICT);
      }
      throw new HttpException(error.messaqe, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('positions')
  @ApiOperation({ summary: 'Mendapatkan daftar posisi trading yang sedang aktif (Open Position)' })
  async getActivePositions() {
    const openPositions = await this.prisma.db.activePosition.findMany();

    if (openPositions.length === 0) {
      return [];
    }

    const positionsWithPnl = await Promise.all(
      openPositions.map(async (pos) => {
        const latestCandle = await this.prisma.db.candle.findFirst({
          where: { symbol: pos.symbol },
          orderBy: { timestamp: 'desc'}
        });

        const currentPrice = latestCandle ? Number(latestCandle.close) : Number(pos.entryPrice);
        const entryPrice = Number(pos.entryPrice)

        const unrealizedPnlPct = ((currentPrice - pos.entryPrice) / pos.entryPrice * 100);

        return {
          id: pos.id,
          symbol: pos.symbol,
          entryPrice: pos.entryPrice,
          currentPrice: currentPrice,
          invested: Number(pos.investedAmount),
          unrealizedPnlPct: parseFloat(unrealizedPnlPct.toFixed(2)),
          createdAt: pos.createdAt,
        };
      })
    );

    return positionsWithPnl;
  }
  
  @Get('history')
  @ApiOperation({ summary: 'Mendapatkan summary transaksi (Trade History)' })
  async getTradeHistory() {
    const history = await this.prisma.db.tradeSimulation.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    return history.map(record => ({
      id: record.id,
      symbol: record.symbol,
      action: record.action,
      price: Number(record.price),
      timestamp: record.timestamp,
      metadata: record.metadata
    }));
  }

  @Get('overview')
  @ApiOperation({ summary: 'Mendapatkan data real-time dan sinyal murni untuk Dashboard (Read-Only)' })
  async getDashboardOverview() {
    const markets = await this.prisma.db.marketConfig.findMany({ where: { isActive: true } });
    
    const overview = await Promise.all(markets.map(async (market) => {
      let price = 0;
      let change24h = 0;
      let volume = 0;
      let mlSignal = 'HOLD';
      let confidence = 0;

      try {
          const ticker = await this.exchangeService.fetchTicker(market.symbol);
          price = ticker.price;
          change24h = ticker.change24h;
          volume = Number((ticker.volume / 1000000).toFixed(2));
      } catch (error: any) {
          this.logger.error(`Gagal tarik ticker ${market.symbol}: ${error.message}`);
      }

      try {
          const prediction = await this.predictionService.predictNextCandle(market.symbol);
          const currentPrice = prediction.current_price;
          const predictedPrice = prediction.predicted_next_price;
          
          if (currentPrice && predictedPrice) {
              const priceChangePct = ((predictedPrice - currentPrice) / currentPrice) * 100;
              
              if (priceChangePct > 0.4) mlSignal = 'BUY';
              else if (priceChangePct < -0.4) mlSignal = 'SELL';
              
              confidence = Math.abs(Number(priceChangePct.toFixed(2))); 
          }
      } catch (error: any) {
          this.logger.error(`Prediksi ML gagal untuk ${market.symbol}: ${error.message}`);
      }
      return {
        symbol: market.symbol,
        price,
        change24h,
        volume,
        mlSignal,
        confidence
      };
    }));

    return { data: overview };
  }
}
