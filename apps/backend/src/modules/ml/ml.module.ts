import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PredictionService } from './prediction.service';
import { DatabaseModule } from '../database/database.module';
import { CandlesModule } from '../candles/candles.module';
import { MlController } from './ml.controller';

@Module({
    imports: [
        HttpModule,
        DatabaseModule,
        CandlesModule,
    ],
    controllers: [MlController],
    providers: [PredictionService],
    exports: [PredictionService],
})
export class MlModule{}