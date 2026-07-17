import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import WebSocket from 'ws';

@Injectable()
export class RiskManagementService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RiskManagementService.name);
    
    private ws!: WebSocket; 
    private reconnectTimeout!: NodeJS.Timeout; 
    
    private readonly wsSymbol = 'solusdt'; 
    private readonly dbSymbol = 'SOL/USDT'; 
    
    private isProcessing = false; 

    constructor(private readonly prisma: PrismaService) {}

    onModuleInit() {
        this.connectWebSocket();
    }

    onModuleDestroy() {
        if (this.ws) {
            this.ws.close();
        }
        clearTimeout(this.reconnectTimeout);
    }

    private connectWebSocket() {
        const wsUrl = `wss://stream.binance.com:9443/ws/${this.wsSymbol}@miniTicker`;
        this.logger.log(`Menghubungkan ke Binance WS: ${wsUrl}`);
        
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
            this.logger.log('✅ Risk Management (WebSocket) Aktif! Memantau harga real-time...');
        });

        this.ws.on('message', async (data: string) => {
            if (this.isProcessing) return;

            try {
                const parsed = JSON.parse(data);
                const currentPrice = parseFloat(parsed.c);

                await this.checkRisk(currentPrice);
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

    private async checkRisk(currentPrice: number) {
        this.isProcessing = true; 
        try {
            const activePosition = await this.prisma.db.activePosition.findUnique({
                where: { symbol: this.dbSymbol }
            });

            if (!activePosition) {
                this.isProcessing = false;
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
                this.logger.warn(`[RISK ALERT] Harga menyentuh batas ${actionType} di ${currentPrice}!`);

                const grossPnL = ((currentPrice - activePosition.entryPrice) / activePosition.entryPrice) * 100;
                
                await this.prisma.db.activePosition.delete({
                    where: { symbol: this.dbSymbol }
                });

                await this.prisma.db.tradeSimulation.create({
                    data: {
                        symbol: this.dbSymbol,
                        action: 'SELL',
                        price: currentPrice,
                        metadata: {
                            trigger: actionType,
                            grossPnL: Number(grossPnL.toFixed(2)),
                            reason: `Posisi ditutup paksa oleh Risk Management (Target ${actionType} tercapai).`,
                        }
                    }
                });

                this.logger.log(`🚨 POSISI DITUTUP. PnL Kotor: ${grossPnL.toFixed(2)}%`);
            }
        } catch (error) {
            const err = error as any;
            if (err.code !== 'P2025') { 
                this.logger.error('Error saat mengevaluasi Risk Management:', error);
            }
        } finally {
            this.isProcessing = false; 
        }
    }
}