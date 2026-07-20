import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PredictionService } from '../../ml/prediction.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DecisionService {
    private readonly logger = new Logger(DecisionService.name);

    private readonly FEE_PER_TRADE_PCT = 0.1;
    private readonly ROUND_TRIP_FEE_PCT = this.FEE_PER_TRADE_PCT * 2;
    private readonly MIN_NET_PROFI_PCT = 0.2;
    private readonly MIN_PRICE_MOVEMENT_PCT = this.ROUND_TRIP_FEE_PCT + this.MIN_NET_PROFI_PCT;
    private readonly STOP_LOSS_PCT = 0.02;
    private readonly TAKE_PROFIT_PCT = 0.04;

    private readonly ALLOCATION_PCT = 0.05;
    private readonly MIN_TRADE_AMOUNT = 10.0

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

        if (priceChangePct > this.MIN_PRICE_MOVEMENT_PCT) {
            if (!activePosition) {
                const wallet = await this.prisma.db.virtualWallet.findUnique({
                    where: { asset: 'USDT' }
                });

                if (!wallet) {
                    action = 'HOLD';
                    reason = `Dompet USDT tidak ditemukan.`;
                } else {
                    let tradeAmount = wallet.balance * this.ALLOCATION_PCT;

                    if (tradeAmount < this.MIN_TRADE_AMOUNT) {
                        tradeAmount = this.MIN_TRADE_AMOUNT;
                    }

                    if (wallet.balance < tradeAmount) {
                        action = 'HOLD';
                        reason = `Prediksi NAIK, tapi Saldo USDT (${wallet.balance.toFixed(2)}) tidak cukup untuk minimum trade ($${tradeAmount.toFixed(2)}).`;
                    } else {
                        action = 'BUY';
                        reason = `Prediksi naik ${priceChangePct.toFixed(2)}%. Position Size: $${tradeAmount.toFixed(2)}. Buka posisi.`;

                        const stopLoss = currentPrice * (1 - this.STOP_LOSS_PCT);
                        const takeProfit = currentPrice * (1 + this.TAKE_PROFIT_PCT);
                        const coinQuantity = tradeAmount / currentPrice;

                        await this.prisma.db.$transaction([
                            this.prisma.db.virtualWallet.update({
                                where: { asset: 'USDT' },
                                data: {
                                    balance: { decrement: tradeAmount },
                                    locked: { increment: tradeAmount }
                                }
                            }),
                            this.prisma.db.activePosition.create({
                                data: {
                                    symbol,
                                    entryPrice: currentPrice,
                                    stopLossPrice: stopLoss,
                                    takeProfitPrice: takeProfit,
                                    investedAmount: tradeAmount,
                                    coinQuantity: coinQuantity,
                                    amount: coinQuantity
                                }
                            })
                        ]);
                    }
                }
            } else {
                action = 'HOLD';
                reason = `Sinyal NAIK (${priceChangePct.toFixed(2)}%), posisi sudah terbuka. Biarkan profit berjalan.`;
            }
        }

        else if (priceChangePct < -this.MIN_PRICE_MOVEMENT_PCT) {
            if (activePosition) {
                action = 'SELL';

                const grossPnL = ((currentPrice - activePosition.entryPrice) / activePosition.entryPrice) * 100;
                const netPnL = grossPnL - this.ROUND_TRIP_FEE_PCT;

                const invested = activePosition.investedAmount;
                const netProfitUsdt = invested * (netPnL / 100);
                const amountToReturn = invested + netProfitUsdt;

                reason = `Sinyal TURUN (${priceChangePct.toFixed(2)}%). Tutup posisi! Net PnL: ${netPnL.toFixed(2)}% (USDT: $${netProfitUsdt.toFixed(2)})`;

                await this.prisma.db.$transaction([
                    this.prisma.db.activePosition.delete({
                        where: { symbol: symbol }
                    }),
                    this.prisma.db.virtualWallet.update({
                        where: { asset: 'USDT' },
                        data: {
                            locked: { decrement: invested },
                            balance: { increment: amountToReturn }
                        }
                    })
                ]);
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
            this.logger.log(`[${symbol}] EKSEKUSI ${action} pada harga ${currentPrice} | Reason: ${reason}`);
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