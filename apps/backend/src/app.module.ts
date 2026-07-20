import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './modules/database/database.module';
import { CandlesModule } from './modules/candles/candles.module';
import { MlModule } from './modules/ml/ml.module';
import { TradingModule } from './modules/trading/trading.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CandlesModule,
    MlModule,
    TradingModule,
    PortfolioModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
