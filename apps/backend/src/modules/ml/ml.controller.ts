import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PredictionService } from './prediction.service';
import { PredictQueryDto } from './dto/predict-query.dto';

@ApiTags('ML')
@Controller('api/ml')
export class MlController {
    constructor(private readonly predictionService: PredictionService) {}

    @Get('predict')
    @ApiOperation({ summary: 'Mendapatkan prediksi harga selanjutnya menggunakan Regresi Linier' })
    async getPrediction(@Query() query: PredictQueryDto) {
        if (!query.symbol) {
            throw new BadRequestException('Parameter symbol wajib disertakan (Contoh: SOL/USDT)');
        }
        return this.predictionService.predictNextCandle(query.symbol);
    }
}