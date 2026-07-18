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

        const wsUrl = `wss://stream.binance.com:9443/ws`;
        this.logger.log(`Menghubungkan ke Binance WS untuk ${streams.length} pair(s)...`);
        
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
            this.logger.log(`✅ WebSocket Aktif! Mensubscribe: ${streams.join(', ')}`);
            
            const subscribeMsg = {
                method: 'SUBSCRIBE',
                params: streams,
                id: 1
            };
            this.ws.send(JSON.stringify(subscribeMsg));
        });

        this.ws.on('message', async (data: string) => {
            try {
                const parsed = JSON.parse(data);
                
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
            this.logger.warn('⚠️ WebSocket Terputus! Mencoba reconnect dalam 5 detik...');
            this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
            this.logger.error(`❌ WebSocket Error: ${error.message}`);
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
            const activePosition = await this.prisma.db.activePosition.findUnique({
                where: { symbol: dbSymbol }
            });

            if (!activePosition) {
                return;
            }

            let actionType = '';
            let isTriggered = false;

            if (currentPrice <= activePosition.stopLossPrice) {
                actionType = 'CUT LOSS';
                isTriggered = true;
            } else if (currentPrice >= activePosition.takeProfitPrice) {
                actionType = 'TAKE PROFIT';
                isTriggered = true;
            }

            if (isTriggered) {
                this.logger.warn(`[RISK ALERT - ${dbSymbol}] Harga menyentuh batas ${actionType} di ${currentPrice}!`);

                const grossPnL = ((currentPrice - activePosition.entryPrice) / activePosition.entryPrice) * 100;
                
                await this.prisma.db.activePosition.delete({
                    where: { symbol: dbSymbol }
                });

                await this.prisma.db.tradeSimulation.create({
                    data: {
                        symbol: dbSymbol,
                        action: 'SELL',
                        price: currentPrice,
                        metadata: {
                            trigger: actionType,
                            grossPnL: Number(grossPnL.toFixed(2)),
                            reason: `Posisi ditutup paksa oleh Risk Management (Target ${actionType} tercapai).`,
                        }
                    }
                });

                this.logger.log(`🚨 [${dbSymbol}] POSISI DITUTUP. PnL Kotor: ${grossPnL.toFixed(2)}%`);
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