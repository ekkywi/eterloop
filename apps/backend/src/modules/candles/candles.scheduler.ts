import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CandlesService } from './candles.service';

@Injectable()
export class CandlesScheduler {
    private readonly logger = new Logger(CandlesService.name);
    
    constructor(private readonly candlesService: CandlesService) {}

    @Cron('5 */15 * * * *')
    async handleCronSync15m() {
        this.logger.log('⏰ Menjalankan Cron Job: Sync Candle 15m untuk SOL/USDT');
        try {
            await this.candlesService.syncCandles('SOL/USDT', '15m', 5);

        } catch (error) {
            this.logger.error(`❌ Cron Job Gagal: ${error.message}`);
        }
    }
}