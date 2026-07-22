import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PredictionService } from '../../ml/prediction.service';
import { PrismaService } from '../../database/prisma.service';
import { SignalEvaluationService } from '../signal/signal-evaluation.service';
import { PositionExecutionService } from '../execution/position-execution.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DecisionService {
    private readonly logger = new Logger(DecisionService.name);

    constructor(
        private readonly predictionService: PredictionService,
        private readonly prisma: PrismaService,
        private readonly signalEvaluationService: SignalEvaluationService,
        private readonly positionExecutionService: PositionExecutionService,
    ) {}

    async evaluateSignal(symbol: string) {
        const [baseAsset, quoteAsset] = symbol.split('/');
        if (!quoteAsset) {
            this.logger.error(`Format simbol tidak valid: ${symbol}. Harap gunakan format BASE/QUOTE.`);
            return { action: 'ERROR', reason: 'Invalid symbol format' };
        }

        const prediction = await this.predictionService.predictNextCandle(symbol, true);
        const currentPrice = prediction.current_price;
        const predictedPrice = prediction.predicted_next_price;

        if (currentPrice === undefined || predictedPrice === undefined) {
            throw new InternalServerErrorException('Gagal mengekstrak harga dari ML Engine.');
        }

        // RC-001: Bungkus seluruh read-check-write dalam transaction Serializable
        // untuk mencegah race condition antara cron job dan RiskManagement WebSocket.
        try {
            const result = await this.prisma.db.$transaction(
                async (tx) => {
                    // Gunakan raw query FOR UPDATE untuk mengunci baris ActivePosition
                    // agar tidak bisa diubah oleh RiskManagement selama evaluasi berlangsung.
                    const lockedPositions: any[] = await tx.$queryRaw(
                        Prisma.sql`SELECT * FROM "ActivePosition" WHERE "symbol" = ${symbol} FOR UPDATE`,
                    );
                    const activePosition = lockedPositions.length > 0 ? lockedPositions[0] : null;

                    const wallet = await tx.virtualWallet.findUnique({
                        where: { asset: quoteAsset },
                    });

                    const decision = this.signalEvaluationService.evaluateExecutionDecision(
                        prediction,
                        {
                            hasOpenPosition: !!activePosition,
                            walletBalance: wallet?.balance ?? 0,
                            quoteAsset,
                        },
                    );

                    if (decision.action === 'BUY' && decision.tradeAmount && decision.stopLoss && decision.takeProfit) {
                        // RC-004: openPosition menggunakan $transaction dengan lock pada wallet juga
                        await this.positionExecutionService.openPositionWithTx(tx, {
                            symbol,
                            currentPrice,
                            tradeAmount: decision.tradeAmount,
                            quoteAsset,
                            stopLoss: decision.stopLoss,
                            takeProfit: decision.takeProfit,
                            reason: decision.reason,
                        });
                    } else if (decision.action === 'SELL' && activePosition) {
                        await this.positionExecutionService.closePositionWithTx(tx, {
                            symbol,
                            currentPrice,
                            quoteAsset,
                            entryPrice: Number(activePosition.entryPrice),
                            investedAmount: Number(activePosition.investedAmount),
                            metadata: {
                                predictedPrice: Number(predictedPrice.toFixed(4)),
                                priceChangePct: Number(decision.priceChangePct.toFixed(2)),
                                reason: decision.reason,
                            },
                        });
                    } else {
                        this.logger.log(`[${symbol}] HOLD - ${decision.reason}`);
                    }

                    return {
                        symbol,
                        action: decision.action,
                        currentPrice,
                        reason: decision.reason,
                    };
                },
                {
                    // RC-001: Isolation level Serializable mencegah phantom reads dan write skew
                    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                },
            );

            return result;
        } catch (error: any) {
            // RC-002: Tangani P2025 (record not found) — posisi sudah dihapus oleh RiskManagement
            if (error.code === 'P2025') {
                this.logger.warn(
                    `[${symbol}] Posisi sudah ditutup oleh RiskManagement sebelum cron job sempat mengeksekusi. Dilewati.`,
                );
                return {
                    symbol,
                    action: 'HOLD',
                    currentPrice,
                    reason: 'Position already closed by RiskManagement (concurrent execution)',
                };
            }

            // Retry pada serialization failure (PostgreSQL error 40001)
            if (error.code === 'P2034' || (error.meta && error.meta.code === '40001')) {
                this.logger.warn(
                    `[${symbol}] Serialization failure pada transaction. Mungkin concurrent execution. Dilewati siklus ini.`,
                );
                return {
                    symbol,
                    action: 'HOLD',
                    currentPrice,
                    reason: 'Transaction serialization failure — will retry next cycle',
                };
            }

            this.logger.error(`[${symbol}] Gagal mengeksekusi keputusan trading: ${error.message}`, error.stack);
            throw error;
        }
    }
}