import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DecisionService } from './decision/decision.service';

@ApiTags('Trading')
@Controller('api/trading')
export class TradingController {
  constructor(private readonly decisionService: DecisionService) {}

  @Get('signal')
  @ApiOperation({ summary: 'Mendapatkan sinyal trading (BUY/SELL/HOLD) berdasarkan prediksi ML' })
  @ApiQuery({ name: 'symbol', required: true, example: 'SOL/USDT' })
  async getSignal(@Query('symbol') symbol: string) {
    if (!symbol) {
      throw new BadRequestException('Parameter symbol wajib disertakan');
    }
    return this.decisionService.evaluateSignal(symbol);
  }
}