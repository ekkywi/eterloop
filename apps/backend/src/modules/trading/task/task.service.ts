import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DecisionService } from '../decision/decision.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TaskService {
    private readonly logger = new Logger(TaskService.name);

    constructor(
        private readonly decisionService: DecisionService,
        private readonly prisma: PrismaService
    ) {}

    @Cron('0 0,15,30,45 * * * *')
    async handleTradingCycle() {
        this.logger.log('=== Memulai Siklus Trading 15 Menit ===');

        try {
            const activeMarkets = await this.prisma.db.marketConfig.findMany({
                where: { isActive: true }
            });

            if (activeMarkets.length === 0) {
                this.logger.warn('Tidak ada koin aktif di MarketConfig. Siklus dilewati.');
                return;
            }

            for (const market of activeMarkets) {
                this.logger.log(`Menganalisis peluang untuk ${market.symbol}...`);
                try {
                    await this.decisionService.evaluateSignal(market.symbol);
                } catch (error) {
                    this.logger.error(`Gagal mengevaluasi ${market.symbol}:`, error);
                }
            }

            this.logger.log('=== Siklus Trading Selesai ===');
        } catch (error) {
            this.logger.error('Terjadi kesalahan fatal pada siklus trading', error);
        }
    }
}