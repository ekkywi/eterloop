import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncCandlesDto {
    @ApiProperty({ description: 'Simbol koin', example: 'BTC/USDT' })
    symbol!: string;

    @ApiProperty({ description: 'Rentang waktu (timeframe)', example: '15m' })
    timeframe!: string;

    @ApiProperty({ description: 'Batas jumlah lilin (candle)', example: 100 })
    limit?: number;
}