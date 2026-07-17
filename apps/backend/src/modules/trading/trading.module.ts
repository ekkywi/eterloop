import { Module } from '@nestjs/common';
import { DecisionService } from './decision/decision.service';
import { MlModule } from '../ml/ml.module';
import { TradingController } from './trading.controller';

@Module({
  imports: [MlModule],
  providers: [DecisionService],
  exports: [DecisionService],
  controllers: [TradingController],
})
export class TradingModule {}
