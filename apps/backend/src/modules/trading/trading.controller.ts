import { PrismaService } from '../database/prisma.service';
import { Controller, Get, Post, Body, Query, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DecisionService } from './decision/decision.service';
import { DashboardService } from './dashboard/dashboard.service';
import { PositionQueryService } from './query/position-query.service';
import { TradeHistoryService } from './query/trade-history.service';
import { MarketConfigService } from './query/market-config.service';
import { ExchangeService } from '../candles/exchange.service';
import { PositionExecutionService } from './execution/position-execution.service';
import { SignalQueryDto } from './dto/signal-query.dto';
import { CreateMarketDto } from './dto/create-market.dto';

@ApiTags('Trading')
@Controller('api/trading')
export class TradingController {
  private readonly logger = new Logger(TradingController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly decisionService: DecisionService,
    private readonly dashboardService: DashboardService,
    private readonly positionQueryService: PositionQueryService,
    private readonly tradeHistoryService: TradeHistoryService,
    private readonly marketConfigService: MarketConfigService,
    private readonly exchangeService: ExchangeService,
    private readonly positionExecutionService: PositionExecutionService,
  ) {}

  @Post('signal/execute')
  @ApiOperation({ summary: 'Mengeksekusi sinyal trading (BUY/SELL/HOLD) berdasarkan prediksi ML' })
  async executeSignal(@Body() body: SignalQueryDto) {
    if (!body.symbol) {
      throw new BadRequestException('Parameter symbol wajib disertakan');
    }
    return this.decisionService.evaluateSignal(body.symbol);
  }

  @Get('signal/preview')
  @ApiOperation({ summary: 'Mendapatkan preview sinyal tanpa eksekusi (read-only)' })
  async getSignalPreview(@Query() query: SignalQueryDto) {
    if (!query.symbol) {
      throw new BadRequestException('Parameter symbol wajib disertakan');
    }
    return this.dashboardService.getSignalPreview(query.symbol);
  }

  @Get('market')
  @ApiOperation({ summary: 'Melihat daftar koin yang sedang dipantau oleh bot' })
  async getMarket() {
    return this.marketConfigService.getAll();
  }

  @Post('position/close')
  @ApiOperation({ summary: 'Menutup posisi secara paksa dari antarmuka Dashboard' })
  async manualClosePosition(@Body() body: { symbol: string }) {
    if (!body.symbol) {
      throw new BadRequestException('Parameter symbol wajib diisi.');
    }

    // Validasi format symbol harus BASE/QUOTE
    const parts = body.symbol.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new BadRequestException(
        `Format symbol tidak valid: "${body.symbol}". Gunakan format BASE/QUOTE (contoh: BTC/USDT)`,
      );
    }

    const activePosition = await this.prisma.db.activePosition.findUnique({
      where: { symbol: body.symbol },
    });

    if (!activePosition) {
      throw new HttpException('Posisi tidak ditemukan atau sudah ditutup oleh bot.', HttpStatus.NOT_FOUND);
    }

    let currentPrice = 0;
    try {
      const ticker = await this.exchangeService.fetchTicker(body.symbol);
      currentPrice = ticker.price;
    } catch (error: any) {
      this.logger.error(`Gagal menarik ticker untuk ${body.symbol}: ${error.message}`);
      throw new HttpException('Gagal mendapatkan harga pasar saat ini.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const quoteAsset = parts[1];

    try {
      const result = await this.positionExecutionService.closePosition({
        symbol: body.symbol,
        currentPrice: currentPrice,
        quoteAsset: quoteAsset,
        entryPrice: Number(activePosition.entryPrice),
        investedAmount: Number(activePosition.investedAmount),
        metadata: { reason: 'MANUAL_FORCE_CLOSE' }
      });

      this.logger.log(`[MANUAL CLOSE] Posisi ${body.symbol} ditutup paksa. PnL: ${result.netPnL}%`);
      return { message: 'Posisi berhasil ditutup', data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('market')
  @ApiOperation({ summary: 'Menambah koin baru untuk dipantau oleh bot' })
  async addMarket(@Body() dto: CreateMarketDto) {
    // Validasi format symbol harus BASE/QUOTE
    const parts = dto.symbol.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new BadRequestException(
        `Format symbol tidak valid: "${dto.symbol}". Gunakan format BASE/QUOTE (contoh: BTC/USDT)`,
      );
    }
    return this.marketConfigService.add(dto.symbol, dto.timeframe);
  }

  @Get('positions')
  @ApiOperation({ summary: 'Mendapatkan daftar posisi trading yang sedang aktif (Open Position)' })
  async getActivePositions() {
    return this.positionQueryService.getActiveWithPnl();
  }

  @Get('history')
  @ApiOperation({ summary: 'Mendapatkan summary transaksi (Trade History)' })
  async getTradeHistory() {
    return this.tradeHistoryService.getRecent(100);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Mendapatkan data real-time dan sinyal murni untuk Dashboard (Read-Only)' })
  async getDashboardOverview() {
    return this.dashboardService.getOverview();
  }
}