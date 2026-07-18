import { Module } from '@nestjs/common';
import { DecisionService } from './decision/decision.service';
import { MlModule } from '../ml/ml.module';
import { DatabaseModule } from '../database/database.module';
import { CandlesModule } from '../candles/candles.module';
import { TradingController } from './trading.controller';
import { TaskService } from './task/task.service';
import { RiskManagementService } from './risk-management/risk-management.service';

@Module({
  imports: [MlModule, DatabaseModule, CandlesModule],
  providers: [DecisionService, TaskService, RiskManagementService],
  exports: [DecisionService],
  controllers: [TradingController],
})
export class TradingModule {}
