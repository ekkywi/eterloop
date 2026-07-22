import { Injectable, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CandlesService } from '../../candles/candles.service';

@Injectable()
export class MarketConfigService {
  private readonly logger = new Logger(MarketConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly candleService: CandlesService,
  ) {}

  async getAll() {
    return this.prisma.db.marketConfig.findMany();
  }

  async add(symbol: string, timeframe?: string) {
    if (!symbol) {
      throw new BadRequestException('Parameter symbol wajib diisi (contoh: BTC/USDT)');
    }

    const uppercaseSymbol = symbol.toUpperCase();
    const tf = timeframe || '15m';

    try {
      const newMarket = await this.prisma.db.marketConfig.create({
        data: {
          symbol: uppercaseSymbol,
          isActive: true,
          timeframe: tf,
        },
      });

      // Trigger async backfill
      this.candleService
        .syncCandles(uppercaseSymbol, tf, 1000)
        .then((res) =>
          this.logger.log(`[Auto-Backfill] Sukses menarik ${res.inserted} candle untuk ${uppercaseSymbol}`),
        )
        .catch((err) => this.logger.error(`[Auto-Backfill] Gagal untuk ${uppercaseSymbol}:`, err.message));

      return {
        message: 'Koin berhasil ditambahkan ke Registry dan proses backfill sedang berjalan di latar belakang.',
        data: newMarket,
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new HttpException('Koin ini sudah terdaftar di database', HttpStatus.CONFLICT);
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}