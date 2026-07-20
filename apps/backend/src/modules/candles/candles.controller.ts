import { Controller, Post, Body, Get, Query, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CandlesService } from './candles.service';
import { SyncCandlesDto } from './dto/sync-candles.dto';
import { BackfillQueryDto } from './dto/backfill-query.dto';
import { GetFeaturesQueryDto } from './dto/get-features-query.dto';

@ApiTags('Candles')
@Controller('api/candles')
export class CandlesController {
    constructor(private readonly candlesService: CandlesService) {}

    @Post('sync')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Sinkronisasi data candle terbaru secara manual' })
    async syncData(@Body() dto: SyncCandlesDto) {
        if (!dto.symbol || !dto.timeframe) {
            throw new BadRequestException('Parameter symbol dan timeframe wajib diisi');
        }

        return this.candlesService.syncCandles(dto.symbol, dto.timeframe, dto.limit);
    }

    @Post('backfill')
    @ApiOperation({ summary: 'Menarik riwayat data candle dalam jumlah besar (Backfill)' })
    async backfillData(@Query() query: BackfillQueryDto) {
        if (!query.symbol) {
            throw new BadRequestException('Parameter symbol wajib diisi');
        }

        const timeframe = query.timeframe || '15m';
        const limitNumber = Number(query.limit) || 1000;

        try {
            await this.candlesService.syncCandles(query.symbol, timeframe, limitNumber);
            return {
                message: `Backfill sukses. Berhasil menarik maksimal ${limitNumber} candle terakhir untuk ${query.symbol}`,
                status: 'success'
            };
        } catch (error: any) {
            return {
                message: `Gagal melakukan backfill: ${error.message}`,
                status: 'error'
            }
        }
    }

    @Get('features')
    @ApiOperation({ summary: 'Melihat hasil perhitungan indikator teknikal (Features) untuk ML' })
    async getFeatures(@Query() query: GetFeaturesQueryDto) {
        if (!query.symbol) {
            throw new BadRequestException('Parameter symbol wajib diisi (contoh: SOL/USDT)');
        }

        const features = await this.candlesService.getTechnicalFeatures(query.symbol);

        return {
            symbol: query.symbol,
            timeframe: '15m',
            features,
            status: features ? 'ready_for_ml' : 'insufficient_data'
        };
    }
}