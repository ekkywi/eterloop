import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PredictionService } from './prediction.service';

@ApiTags('ML')
@Controller('api/ml')
export class MlController {
    constructor(private readonly predictionService: PredictionService) {}

    @Get('predict')
    @ApiOperation({ summary: 'Mendapatkan prediksi harga selanjutnya menggunakan Regresi Linier' })
    @ApiQuery({ name: 'symbol', required: true, example: 'SOL/USDT' })
    async getPrediction(@Query('symbol') symbol: string) {
        if (!symbol) {
            throw new BadRequestException('Parameter symbol wajib disertakan (Contoh: SOL/USDT)');
        }
        return this.predictionService.predictNextCandle(symbol);
    }
}