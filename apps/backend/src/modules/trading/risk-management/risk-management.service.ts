import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PositionExecutionService } from '../execution/position-execution.service';
import { MarketDataService, PriceTick } from '../market-data/market-data.service';

/**
 * RiskManagementService — Memantau SL/TP posisi aktif menggunakan harga real-time.
 *
 * RC-005 & AS-001: Sekarang subscribe ke MarketDataService (single WebSocket gateway)
 * alih-alih membuka koneksi WebSocket sendiri. Ini menghilangkan duplikasi koneksi
 * dan memungkinkan data yang sama dibagikan ke DashboardService.
 *
 * RC-008: processingLocks sekarang menggunakan timeout untuk mencegah stuck lock.
 * RC-009: Heartbeat ditangani oleh MarketDataService.
 */
@Injectable()
export class RiskManagementService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RiskManagementService.name);

    // RC-008: Gunakan Map<string, number> untuk menyimpan timestamp lock,
    // sehingga lock yang stuck bisa dideteksi dan di-clear.
    private processingLocks: Map<string, number> = new Map();
    private readonly LOCK_TIMEOUT_MS = 30000; // 30 detik — lock otomatis expired

    // Set symbol yang sedang dipantau
    private monitoredSymbols: Set<string> = new Set();

    constructor(
        private readonly prisma: PrismaService,
        private readonly positionExecutionService: PositionExecutionService,
        private readonly marketDataService: MarketDataService,
    ) {}

    async onModuleInit() {
        await this.loadMonitoredSymbols();
        this.subscribeToMarketData();
    }

    onModuleDestroy() {
        // Unsubscribe dari semua event MarketDataService
        for (const symbol of this.monitoredSymbols) {
            this.marketDataService.removeAllListeners(`price:${symbol}`);
        }
        this.marketDataService.removeAllListeners('price:all');
        this.processingLocks.clear();
    }

    /**
     * Muat daftar symbol yang aktif dari database.
     */
    private async loadMonitoredSymbols() {
        const activeMarkets = await this.prisma.db.marketConfig.findMany({
            where: { isActive: true },
        });

        this.monitoredSymbols.clear();
        for (const market of activeMarkets) {
            const parts = market.symbol.split('/');
            if (parts.length === 2 && parts[0] && parts[1]) {
                this.monitoredSymbols.add(market.symbol);
                this.processingLocks.set(market.symbol, 0);
            }
        }

        this.logger.log(`[RiskMgmt] Memantau ${this.monitoredSymbols.size} symbol untuk SL/TP.`);
    }

    /**
     * Subscribe ke MarketDataService untuk menerima harga real-time.
     * Menggantikan koneksi WebSocket sendiri (sebelumnya di RiskManagementService).
     */
    private subscribeToMarketData() {
        // Subscribe ke event 'price:all' untuk semua symbol
        this.marketDataService.on('price:all', (tick: PriceTick) => {
            if (this.monitoredSymbols.has(tick.symbol)) {
                this.handlePriceTick(tick);
            }
        });

        this.logger.log('[RiskMgmt] Terhubung ke MarketDataService untuk monitoring SL/TP.');
    }

    /**
     * Handle setiap tick harga dari MarketDataService.
     */
    private async handlePriceTick(tick: PriceTick) {
        const dbSymbol = tick.symbol;
        const currentPrice = tick.price;

        // RC-008: Cek apakah lock masih valid (belum expired)
        const lockTimestamp = this.processingLocks.get(dbSymbol) || 0;
        const now = Date.now();

        if (lockTimestamp > 0) {
            // Ada lock aktif — cek apakah sudah expired
            if (now - lockTimestamp > this.LOCK_TIMEOUT_MS) {
                this.logger.warn(
                    `[RiskMgmt] Lock untuk ${dbSymbol} sudah expired (${now - lockTimestamp}ms). Di-clear paksa.`,
                );
                this.processingLocks.set(dbSymbol, 0);
            } else {
                // Lock masih valid — skip tick ini
                return;
            }
        }

        // Set lock dengan timestamp saat ini
        this.processingLocks.set(dbSymbol, now);

        try {
            await this.checkRisk(dbSymbol, currentPrice);
        } finally {
            // RC-008: Clear lock setelah selesai (selalu di finally)
            this.processingLocks.set(dbSymbol, 0);
        }
    }

    /**
     * Periksa apakah harga saat ini menyentuh SL atau TP.
     */
    private async checkRisk(dbSymbol: string, currentPrice: number) {
        try {
            const [baseAsset, quoteAsset] = dbSymbol.split('/');
            if (!quoteAsset) {
                this.logger.error(`Format simbol tidak valid: ${dbSymbol}`);
                return;
            }

            const activePosition = await this.prisma.db.activePosition.findUnique({
                where: { symbol: dbSymbol },
            });

            if (!activePosition) {
                return;
            }

            let actionType = '';
            let isTriggered = false;

            if (currentPrice <= Number(activePosition.stopLossPrice)) {
                actionType = 'CUT LOSS';
                isTriggered = true;
            } else if (currentPrice >= Number(activePosition.takeProfitPrice)) {
                actionType = 'TAKE PROFIT';
                isTriggered = true;
            }

            if (isTriggered) {
                this.logger.warn(
                    `[RISK ALERT - ${dbSymbol}] Harga menyentuh batas ${actionType} di ${currentPrice}`,
                );

                await this.positionExecutionService.closePosition({
                    symbol: dbSymbol,
                    currentPrice,
                    quoteAsset,
                    entryPrice: Number(activePosition.entryPrice),
                    investedAmount: Number(activePosition.investedAmount),
                    metadata: {
                        trigger: actionType,
                        reason: `Posisi ditutup oleh Risk Management (Target ${actionType} tercapai).`,
                    },
                });
            }
        } catch (error) {
            const err = error as any;
            // RC-002: Tangani P2025 (posisi sudah dihapus oleh cron job)
            if (err.code === 'P2025') {
                this.logger.warn(
                    `[RiskMgmt] Posisi ${dbSymbol} sudah ditutup oleh DecisionService. Dilewati.`,
                );
            } else {
                this.logger.error(`Error Risk Management [${dbSymbol}]:`, error);
            }
        }
    }
}