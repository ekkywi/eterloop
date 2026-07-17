import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DecisionService } from '../decision/decision.service';

@Injectable()
export class TaskService {
    private readonly logger = new Logger(TaskService.name);

    constructor(private readonly decisionService: DecisionService) {}

    @Cron('0 0,15,30,45 * * * *')
    async handleTradingCycle() {
        this.logger.log('Memulai siklus otomatis bot trading...');
        const symbol = 'SOL/USDT';

        try {
            await this.decisionService.evaluateSignal(symbol);
            this.logger.log(`Siklus trading otomatis untuk ${symbol} selesai di eksekusi.`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.stack : String(error);
            this.logger.error(`Gagal mengeksekusi siklus trading untuk ${symbol}`, errorMessage);
        }
    }
}