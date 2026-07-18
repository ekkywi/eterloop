import { Controller, Get, Post, Body, Query, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { DecisionService } from './decision/decision.service';
import { PrismaService } from '../database/prisma.service';
import { CandlesService } from '../candles/candles.service';

@ApiTags('Trading')
@Controller('api/trading')
export class TradingController {
  private readonly logger = new Logger(TradingController.name);

  constructor(
    private readonly decisionService: DecisionService,
    private readonly prisma: PrismaService,
    private readonly candlesService: CandlesService
  ) {}

  @Get('signal')
  @ApiOperation({ summary: 'Mendapatkan sinyal trading (BUY/SELL/HOLD) berdasarkan prediksi ML' })
  @ApiQuery({ name: 'symbol', required: true, example: 'SOL/USDT' })
  async getSignal(@Query('symbol') symbol: string) {
    if (!symbol) {
      throw new BadRequestException('Parameter symbol wajib disertakan');
    }
    return this.decisionService.evaluateSignal(symbol);
  }

  @Get('market')
  @ApiOperation({ summary: 'Melihat daftar koin yang sedang dipantau oleh bot' })
  async getMarkets() {
    return this.prisma.db.marketConfig.findMany();
  }

  @Post('market')
  @ApiOperation({ summary: 'Menambahkan koin baru untuk dipantau bot' })
  @ApiBody({ 
    schema: { 
      type: 'object', 
      properties: { 
        symbol: { type: 'string', example: 'BTC/USDT' },
        timeframe: { type: 'string', example: '15m', default: '15m' }
      } 
    } 
  })
  async addMarket(@Body() body: { symbol: string; timeframe?: string }) {
    if (!body.symbol) {
      throw new BadRequestException('Parameter symbol wajib diisi (contoh: BTC/USDT)');
    }

    const uppercaseSymbol = body.symbol.toUpperCase();
    const timeframe = body.timeframe || '15m';

    try {
      const newMarket = await this.prisma.db.marketConfig.create({
        data: {
          symbol: uppercaseSymbol,
          isActive: true,
          timeframe: timeframe
        }
      });

      this.candlesService.syncCandles(uppercaseSymbol, timeframe, 1000)
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
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}