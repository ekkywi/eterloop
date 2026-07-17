import { Controller, Post, Body, Get, Query, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { CandlesService } from './candles.service';

@Controller('api/candles')
export class CandlesController {
    constructor(private readonly candlesService: CandlesService) {}
    
    @Post('sync')
    @HttpCode(HttpStatus.OK)
    async syncData(
        @Body('symbol') symbol: string,
        @Body('timeframe') timeframe: string,
        @Body('limit') limit?: number,
    ) {
        if (!symbol || !timeframe) {
            throw new BadRequestException('Parameter symbol dan timeframe wajib diisi');
        }

        return this.candlesService.syncCandles(symbol, timeframe, limit);
    }

    @Post('backfill')
    async backfillData(
        @Query('symbol') symbol: string,
        @Query('timeframe') timeframe: string = '15m',
        @Query('limit') limit: number = 1000,
    ) {
        if (!symbol) {
            return { statusCode: 400, message: 'Parameter symbol wajib diisi' };
        }

        const limitNumber = Number(limit);

        try {
            await this.candlesService.syncCandles(symbol, timeframe, limitNumber);
            return {
                message: `Backfill sukses. Berhasil menarik maksimal ${limitNumber} candle terakhir untuk ${symbol}.`,
                status: 'success'
            };
        } catch (error) {
            return {
                message: `Gagal melakukan backfill: ${error.message}`,
                status: 'error'
            }
        }
    }

    @Get('features')
    async getFeatures(@Query('symbol') symbol: string) {
        if (!symbol) {
            return { statusCode: 400, message: 'Parameter symbol wajib diisi (contoh: SOL/USDT)' };
        }

        const features = await this.candlesService.getTechnicalFeatures(symbol);

        return {
            symbol,
            timeframe: '15m',
            features,
            status: features ? 'ready_for_ml' : 'insufficient_data'
        };
    }
}