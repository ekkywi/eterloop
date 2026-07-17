import { Module } from '@nestjs/common';
import { CandlesService } from './candles.service';
import { ExchangeService } from './exchange.service';
import { CandlesController } from './candles.controller';
import { CandlesScheduler } from './candles.scheduler';
import { DatabaseModule } from '../database/database.module';
import { IndicatorsService } from './indicators.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CandlesController],
  providers: [
    CandlesService,
    ExchangeService,
    CandlesScheduler,
    IndicatorsService
  ],
  exports: [CandlesService, IndicatorsService],
})
export class CandlesModule {}
