import { Module } from '@nestjs/common';
import { DecisionService } from './decision/decision.service';
import { SignalEvaluationService } from './signal/signal-evaluation.service';
import { PositionExecutionService } from './execution/position-execution.service';
import { DashboardService } from './dashboard/dashboard.service';
import { MlModule } from '../ml/ml.module';
import { DatabaseModule } from '../database/database.module';
import { CandlesModule } from '../candles/candles.module';
import { TradingController } from './trading.controller';
import { TaskService } from './task/task.service';
import { RiskManagementService } from './risk-management/risk-management.service';
import { MarketDataService } from './market-data/market-data.service';
import { PositionQueryService } from './query/position-query.service';
import { TradeHistoryService } from './query/trade-history.service';
import { MarketConfigService } from './query/market-config.service';

@Module({
  imports: [MlModule, DatabaseModule, CandlesModule],
  providers: [
    DecisionService,
    SignalEvaluationService,
    PositionExecutionService,
    DashboardService,
    TaskService,
    RiskManagementService,
    MarketDataService,
    PositionQueryService,
    TradeHistoryService,
    MarketConfigService,
  ],
  exports: [DecisionService, SignalEvaluationService, PositionExecutionService],
  controllers: [TradingController],
})
export class TradingModule {}