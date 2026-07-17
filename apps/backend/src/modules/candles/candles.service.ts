import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ExchangeService } from './exchange.service';
import { IndicatorsService } from './indicators.service';

@Injectable()
export class CandlesService {
    private readonly logger = new Logger(CandlesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly exchange: ExchangeService,
        private readonly indicators: IndicatorsService,
    ) {}

    async syncCandles(symbol: string, timeframe: string, limit: number = 100) {
        this.logger.log(`Memulai sinkronisasi ${limit} candle untuk ${symbol} (${timeframe})...`);

        const marketData = await this.exchange.fetchOHLCV(symbol, timeframe, limit);

        if (marketData.length === 0) {
            this.logger.warn(`Tidak ada data dari exchange untuk ${symbol}`);
            return { inserted: 0 };
        }

        const payload = marketData.map((candle) => ({
            symbol,
            timestamp: candle.timestamp,
            open: new Prisma.Decimal(candle.open),
            high: new Prisma.Decimal(candle.high),
            low: new Prisma.Decimal(candle.low),
            close: new Prisma.Decimal(candle.close),
            volume: new Prisma.Decimal(candle.volume),
        }));

        try {
            const result = await this.prisma.db.candle.createMany({
                data: payload,
                skipDuplicates: true,
            });

            this.logger.log(`Berhasil menyimpan ${result.count} candle baru ke database.`)
            return { inserted: result.count };
        } catch (error) {
            this.logger.error(`Database error saat menyimpan candle: ${error.message}`);
            throw error;
        }
    }

    async getTechnicalFeatures(symbol: string) {
        const limit = 100;
        
        const candles = await this.prisma.db.candle.findMany({
            where: { symbol },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });

        if (candles.length < 35) {
            return null;
        }

        const closePrices = candles.reverse().map(c => Number(c.close));

        return {
            currentPrice: closePrices[closePrices.length - 1],
            rsi_14: this.indicators.calculateRSI(closePrices, 14),
            macd: this.indicators.calculateMACD(closePrices),
            ema_20: this.indicators.calculateEMA(closePrices, 20),
        };
    }
}