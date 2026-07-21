import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BackfillQueryDto {
    @ApiProperty({ description: 'Simbol koin', example: 'SOL/USDT' })
    symbol!: string;

    @ApiProperty({ description: 'Rentang waktu (timeframe)', example: '15m' })
    timeframe?: string;

    @ApiProperty({ description: 'Batas tarikan data', example: 1000, default: 1000 })
    limit?: number;
}