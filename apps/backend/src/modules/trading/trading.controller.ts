import { Controller, Get, Post, Body, Query, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DecisionService } from './decision/decision.service';
import { PrismaService } from '../database/prisma.service';
import { CandlesService } from '../candles/candles.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { SignalQueryDto } from './dto/signal-query.dto';

@ApiTags('Trading')
@Controller('api/trading')
export class TradingController {
  private readonly logger = new Logger(TradingController.name);

  constructor(
    private readonly decisionService: DecisionService,
    private readonly prisma: PrismaService,
    private readonly candleService: CandlesService
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
      throw new HttpException(error.messaqe, HttpStatus.INTERNAL_SERVER_ERROR);3
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
}