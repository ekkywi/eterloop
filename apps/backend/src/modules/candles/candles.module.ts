import { Module } from '@nestjs/common';
import { CandlesService } from './candles.service';
import { ExchangeService } from './exchange.service';
import { CandlesController } from './candles.controller';
import { FeatureExtractionService } from './feature-extraction.service';
import { DatabaseModule } from '../database/database.module';
import { IndicatorsService } from './indicators.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CandlesController],
  providers: [
    CandlesService,
    ExchangeService,
    FeatureExtractionService,
    IndicatorsService,
  ],
  exports: [CandlesService, FeatureExtractionService, IndicatorsService, ExchangeService],
})
export class CandlesModule {}