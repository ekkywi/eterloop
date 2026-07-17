import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PredictionService } from '../../ml/prediction.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DecisionService {
    private readonly logger = new Logger(DecisionService.name);
    
    // Konfigurasi Biaya & Profit
    private readonly FEE_PER_TRADE_PCT = 0.1; // 0.1% Binance Base Fee
    private readonly ROUND_TRIP_FEE_PCT = this.FEE_PER_TRADE_PCT * 2; // Beli (0.1%) + Jual (0.1%) = 0.2%
    private readonly MIN_NET_PROFIT_PCT = 0.2; // Bersih yang ingin dibawa pulang (di luar fee)
    
    // Target pergerakan harga minimum (0.2% + 0.2% = 0.4%)
    private readonly MIN_PRICE_MOVEMENT_PCT = this.ROUND_TRIP_FEE_PCT + this.MIN_NET_PROFIT_PCT; 
    
    private readonly STOP_LOSS_PCT = 0.02; // SL 2%
    private readonly TAKE_PROFIT_PCT = 0.04; // TP 4% (Target TP juga harus jauh di atas fee)

    constructor(
        private readonly predictionService: PredictionService,
        private readonly prisma: PrismaService
    ) {}

    async evaluateSignal(symbol: string) {
        const prediction = await this.predictionService.predictNextCandle(symbol);
        
        const currentPrice = prediction.current_price;
        const predictedPrice = prediction.predicted_next_price;

        if (currentPrice === undefined || predictedPrice === undefined) {
            throw new InternalServerErrorException('Gagal mengekstrak harga dari ML Engine.');
        }

        const priceChangePct = ((predictedPrice - currentPrice) / currentPrice) * 100;
        
        const activePosition = await this.prisma.db.activePosition.findUnique({
            where: { symbol: symbol }
        });

        let action = 'HOLD';
        let reason = `Pergerakan (${priceChangePct.toFixed(2)}%) tidak menutupi round-trip fee (${this.ROUND_TRIP_FEE_PCT}%) dan target profit.`;

        // Logika Sinyal NAIK (BUY)
        if (priceChangePct > this.MIN_PRICE_MOVEMENT_PCT) {
            if (!activePosition) {
                action = 'BUY';
                reason = `Prediksi naik ${priceChangePct.toFixed(2)}%. Mengkover fee 0.2% dengan ekspektasi net profit bersih. Buka posisi.`;
                
                const stopLoss = currentPrice * (1 - this.STOP_LOSS_PCT);
                const takeProfit = currentPrice * (1 + this.TAKE_PROFIT_PCT);

                await this.prisma.db.activePosition.create({
                    data: {
                        symbol,
                        entryPrice: currentPrice,
                        amount: 1, 
                        stopLossPrice: stopLoss,
                        takeProfitPrice: takeProfit
                    }
                });
            } else {
                action = 'HOLD';
                reason = `Sinyal NAIK (${priceChangePct.toFixed(2)}%), posisi sudah terbuka. Biarkan profit berjalan.`;
            }
        } 
        // Logika Sinyal TURUN (SELL)
        else if (priceChangePct < -this.MIN_PRICE_MOVEMENT_PCT) {
            if (activePosition) {
                action = 'SELL';
                
                const grossPnL = ((currentPrice - activePosition.entryPrice) / activePosition.entryPrice) * 100;
                const netPnL = grossPnL - this.ROUND_TRIP_FEE_PCT; // Kurangi fee dari profit kotor

                reason = `Sinyal TURUN (${priceChangePct.toFixed(2)}%). Tutup posisi! Net PnL (setelah fee): ${netPnL.toFixed(2)}%`;

                await this.prisma.db.activePosition.delete({
                    where: { symbol: symbol }
                });
            } else {
                action = 'HOLD';
                reason = `Sinyal TURUN (${priceChangePct.toFixed(2)}%), posisi kosong. Abaikan.`;
            }
        }

        if (action === 'BUY' || action === 'SELL') {
            await this.prisma.db.tradeSimulation.create({
                data: {
                    symbol,
                    action,
                    price: currentPrice,
                    metadata: {
                        predictedPrice: Number(predictedPrice.toFixed(4)),
                        priceChangePct: Number(priceChangePct.toFixed(2)),
                        netPnLEstimate: action === 'SELL' ? reason : null, 
                        reason,
                    }
                }
            });
            this.logger.log(`[${symbol}] EKSEKUSI ${action} pada harga ${currentPrice}`);
        } else {
            this.logger.log(`[${symbol}] HOLD - ${reason}`);
        }

        return {
            symbol,
            action,
            currentPrice,
            reason
        };
    }
}