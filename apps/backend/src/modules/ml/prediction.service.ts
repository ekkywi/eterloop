import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { FeatureExtractionService } from '../candles/feature-extraction.service';

@Injectable()
export class PredictionService {
    private readonly logger = new Logger(PredictionService.name);
    private predictionCache: Map<string, { data: any; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 300000; 

    constructor(
        private readonly featureExtractionService: FeatureExtractionService,
        private readonly httpService: HttpService,
    ) {}

    async predictNextCandle(symbol: string, forceRefresh: boolean = false) {
        const now = Date.now();
        const cached = this.predictionCache.get(symbol);

        if (!forceRefresh && cached && (now - cached.timestamp < this.CACHE_TTL)) {
            this.logger.debug(`[CACHE HIT] Menggunakan prediksi XGBoost tersimpan untuk ${symbol}`);
            return cached.data;
        }

        const candles = await this.featureExtractionService.getRawCandlesForML(symbol, 150);
        
        try {
            this.logger.log(`[ML FETCH] Mengirim data mentah [${candles.length} candle] ke XGBoost Engine untuk ${symbol}...`);

            const response = await firstValueFrom(
                this.httpService.post('http://localhost:8000/predict/xgboost', {
                    symbol: symbol,
                    candles: candles,
                })
            );

            const currentPrice = candles[candles.length - 1].close;

            const result = {
                symbol,
                current_price: currentPrice,
                predicted_next_price: response.data.prediction,
                model: 'XGBoost',
                data_points_used: candles.length
            };

            this.predictionCache.set(symbol, {
                data: result,
                timestamp: now
            });

            return result;

        } catch (error: any) {
            this.logger.error(`Gagal menghubungi ML Engine: ${error.message}`);
            throw new InternalServerErrorException('ML Engine tidak merespons atau gagal melakukan kalkulasi XGBoost.');
        }
    }
}