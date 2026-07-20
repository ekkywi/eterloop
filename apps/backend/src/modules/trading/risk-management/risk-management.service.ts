import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import WebSocket from 'ws';

@Injectable()
export class RiskManagementService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RiskManagementService.name);

    private ws!: WebSocket;
    private reconnectTimeout!: NodeJS.Timeout;

    private binanceToDbSymbol: Map<string, string> = new Map();
    private processingLocks: Map<string, boolean> = new Map();

    private readonly ROUND_TRIP_FEE_PCT = 0.2;

    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        await this.connectWebSocket();
    }

    onModuleDestroy() {
        if (this.ws) {
            this.ws.close();
        }
        clearTimeout(this.reconnectTimeout);
    }

    private async connectWebSocket() {
        const activeMarkets = await this.prisma.db.marketConfig.findMany({
            where: { isActive: true }
        });

        if (activeMarkets.length === 0) {
            this.logger.warn('Tidak ada koin aktif di MarketConfig. WebSocket diam.');
            return;
        }

        const streams: string[] = [];
        this.binanceToDbSymbol.clear();

        for (const market of activeMarkets) {
            const dbSymbol = market.symbol;
            const binanceSymbol = dbSymbol.replace('/', '');
            const streamName = `${binanceSymbol.toLowerCase()}@miniTicker`;

            streams.push(streamName);
            this.binanceToDbSymbol.set(binanceSymbol, dbSymbol);
            this.processingLocks.set(dbSymbol, false);
        }

        const streamPath = streams.join('/');
        const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamPath}`;
        this.logger.log(`Menghubungkan ke Binance WS untuk ${streams.length} pair(s)...`);

        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
            this.logger.log(`✅ WebSocket Aktif via Combined Stream! (${streams.length} pairs)`);
        });

        this.ws.on('message', async (data: string) => {
            try {
                const rawParsed = JSON.parse(data);
                const parsed = rawParsed.data || rawParsed;

                if (!parsed.c || !parsed.s) return; 

                const currentPrice = parseFloat(parsed.c);
                const binanceSymbol = parsed.s;
                
                const dbSymbol = this.binanceToDbSymbol.get(binanceSymbol);
                if (!dbSymbol) return;

                if (this.processingLocks.get(dbSymbol)) return;

                this.processingLocks.set(dbSymbol, true);
                
                await this.checkRisk(dbSymbol, currentPrice);
            } catch (error) {
                this.logger.error('Gagal mem-parsing data WebSocket', error);
            }
        });

        this.ws.on('close', () => {
            this.logger.warn('WebSocket Terputus! Mencoba reconnect dalam 5 detik...');
            this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
            this.logger.error(`WebSocket Error: ${error.message}`);
            this.ws.close();
        });
    }

    private scheduleReconnect() {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
            this.connectWebSocket();
        }, 5000);
    }

    private async checkRisk(dbSymbol: string, currentPrice: number) {
        try {
            const [baseAsset, quoteAsset] = dbSymbol.split('/');
            if (!quoteAsset) {
                this.logger.error(`Format simbol tidak valid: ${dbSymbol}`);
                return;
            }

            const activePosition = await this.prisma.db.activePosition.findUnique({
                where: { symbol: dbSymbol }
            });

            if (!activePosition) {
                return;
            }

            let actionType = '';
            let isTriggered = false;

            if(currentPrice <= activePosition.stopLossPrice) {
                actionType = 'CUT LOSS';
                isTriggered = true;
            } else if ( currentPrice >= activePosition.takeProfitPrice) {
                actionType = 'TAKE PROFIT';
                isTriggered = true;
            }

            if (isTriggered) {
                this.logger.warn(`[RISK ALERT - ${dbSymbol}] Harga menyentuh batas ${actionType} di ${currentPrice}`);

                const grossPnL = ((currentPrice - activePosition.entryPrice) / activePosition.entryPrice) * 100;
                const netPnL = grossPnL - this.ROUND_TRIP_FEE_PCT;
                
                const invested = activePosition.investedAmount;
                const netProfitUsdt = invested * (netPnL / 100);
                const amountToReturn = invested + netProfitUsdt;

                await this.prisma.db.$transaction([
                    this.prisma.db.activePosition.delete({
                        where: { symbol: dbSymbol }
                    }),

                    this.prisma.db.virtualWallet.update({
                        where: { asset: quoteAsset },
                        data: {
                            locked: { decrement: invested },
                            balance: { increment: amountToReturn }
                        }
                    }),

                    this.prisma.db.tradeSimulation.create({
                        data: {
                            symbol: dbSymbol,
                            action: 'SELL',
                            price: currentPrice,
                            metadata: {
                                trigger: actionType,
                                grossPnL: Number(grossPnL.toFixed(2)),
                                netPnL: Number(netPnL.toFixed(2)),
                                netProfitUsdt: Number(netProfitUsdt.toFixed(2)),
                                reason: `Posisi ditutup pak oleh Risk Management (Target ${actionType} tercapai).`,
                            }
                        }
                    })
                ]);

                this.logger.log(`[${dbSymbol}] POSISI DITUTUP (${actionType}). Net PnL: ${netPnL.toFixed(2)}% (USDT: $${netProfitUsdt.toFixed(2)})`);
            }
        } catch (error) {
            const err = error as any;
            if (err.code !== 'P2025') {
                this.logger.error(`Error Risk Management [${dbSymbol}]:`, error);
            }
        } finally {
            this.processingLocks.set(dbSymbol, false);
        }
    }
}