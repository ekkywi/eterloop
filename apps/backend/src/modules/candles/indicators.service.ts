import { Injectable, Logger } from '@nestjs/common';
import { RSI, MACD, EMA } from 'technicalindicators';

@Injectable()
export class IndicatorsService {
    private readonly logger = new Logger(IndicatorsService.name);

    /**
     * Menghitung nilai RSI (Relative Strength Index)
     * @param closePrices Array harga penutupan (diurutkan dari terlama ke terbaru)
     * @param period Periode RSI (default: 14)
     * @returns Nilai RSI terbaru atau null jika data tidak cukup
     */
    calculateRSI(closePrices: number[], period: number = 14): number | null {
        if (closePrices.length < period) {
            this.logger.warn(`Data tidak cukup untuk kalkulasi RSI. Butuh ${period}, tersedia ${closePrices.length}`);
            return null;
        }

        const result = RSI.calculate({
            values: closePrices,
            period: period,
        });

        return result.length > 0 ? result[result.length - 1] : null;
    }

    calculateMACD(closePrices: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (closePrices.length < slowPeriod + signalPeriod) return null;

        const result = MACD.calculate({
            values: closePrices,
            fastPeriod,
            slowPeriod,
            signalPeriod,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
        });

        return result.length > 0 ? result[result.length - 1] : null;
    }

    calculateEMA(closePrices: number[], period = 20): number | null {
        if (closePrices.length < period) return null;

        const result = EMA.calculate({ period, values: closePrices });

        return result.length > 0 ? result[result.length - 1] : null;
    }
}