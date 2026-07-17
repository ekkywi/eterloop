import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../database/prisma.service';
import { IndicatorsService } from '../candles/indicators.service';

@Injectable()
export class PredictionService {
    private readonly logger = new Logger(PredictionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly indicators: IndicatorsService,
        private readonly httpService: HttpService,
    ) {}

    async predictNextCandle(symbol: string) {
        const candles = await this.prisma.db.candle.findMany({
            where: { symbol },
            orderBy: { timestamp: 'asc' },
            take: 500,
        });

        if (candles.length < 50) {
            throw new InternalServerErrorException('Data historis tidak mencukupi untuk ML (Minimal 50 candle)');
        }

        const closePrices = candles.map(c => Number(c.close));
        const datasetX: number[][] = [];
        const datasetY: number[] = [];

        for (let i = 35; i < closePrices.length - 1; i++) {
            const historySlice = closePrices.slice(0, i + 1);
            const rsi = this.indicators.calculateRSI(historySlice, 14);
            const macd = this.indicators.calculateMACD(historySlice);

            if (rsi !== null && macd !== null && macd.MACD !== undefined) {
                datasetX.push([ historySlice[historySlice.length - 1], rsi, macd.MACD ]);
                datasetY.push(closePrices[i + 1]);
            }
        }

        const currentRSI = this.indicators.calculateRSI(closePrices, 14);
        const currentMACD = this.indicators.calculateMACD(closePrices);

        if (currentRSI === null || currentMACD === null || currentMACD === undefined) {
            throw new InternalServerErrorException('Gagal mengekstrak fitur indikator saat ini. Data mungkin tidak mencukupi.');
        }

        const currentFeatures = [
            closePrices[closePrices.length - 1],
            currentRSI,
            currentMACD.MACD,
        ];

        try {
            this.logger.log(`Mengirim matriks [${datasetX.length} baris] ke ML Engine untuk ${symbol}...`);

            const response = await firstValueFrom(
                this.httpService.post('http://localhost:8000/predict/linear-regression', {
                    X: datasetX,
                    y: datasetY,
                    current_features: currentFeatures,
                })
            );

            return {
                symbol,
                current_price: currentFeatures[0],
                predicted_next_price: response.data.prediction,
                model: 'Linear Regression (OLS)',
                data_points_used: datasetX.length
            };

        } catch (error) {
            this.logger.error(`Gagal menghubungi ML Engine: ${error.message}`);
            throw new InternalServerErrorException('ML Engine tidak merespons atau gagal melakukan kalkulasi.');
        }
    }
}