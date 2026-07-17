import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PredictionService } from '../../ml/prediction.service';

@Injectable()
export class DecisionService {
    private readonly logger = new Logger(DecisionService.name);
    private readonly TRADING_FEE_PCT = 0.1;
    private readonly MIN_PROFIT_TARGET_PCT = 0.3;

    constructor(private readonly predictionService: PredictionService) {}

    async evaluateSignal(symbol: string) {
        const prediction = await this.predictionService.predictNextCandle(symbol);
        
        const currentPrice = prediction.current_price;
        const predictedPrice = prediction.predicted_next_price;

        if (currentPrice === undefined || predictedPrice === undefined) {
            throw new InternalServerErrorException('Gagal mengekstrak harga atau prediksi dari ML Engine.');
        }

        const priceChangePct = ((predictedPrice - currentPrice) / currentPrice) * 100;

        let action = 'HOLD';
        let reason = 'Pergerakan harga diprediksi terlalu kecil untuk menutupi fee (sideways).';

        if (priceChangePct > this.MIN_PROFIT_TARGET_PCT) {
            action = 'BUY';
            reason = `Prediksi kenaikan ${priceChangePct.toFixed(2)}% melebihi target minimal ${this.MIN_PROFIT_TARGET_PCT}%. Profit margin rasional.`;
        } else if (priceChangePct < -this.MIN_PROFIT_TARGET_PCT) {
            action = 'SELL_SIGNAL';
            reason = `Prediksi penurunan ${priceChangePct.toFixed(2)}%. Risiko kerugian (Downtrend).`;
        }

        const signal = {
            symbol,
            action,
            currentPrice,
            predictedPrice: Number(predictedPrice.toFixed(4)),
            priceChangePct: Number(priceChangePct.toFixed(2)),
            reason,
            timestamp: new Date().toISOString() 
        };

        this.logger.log(`[${symbol}] Signal: ${action} | Change: ${priceChangePct.toFixed(2)}%`);

        return signal;
    }
}