import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMarketDto {
    @ApiProperty({
        description: 'Simbol koin yang ingin ditambahkan (wajib format BASE/QUOTE)',
        example: 'BTC/USDT'
    })
    symbol!: string;

    @ApiPropertyOptional({
        description: 'Rentang wakty candle (default: 15m)',
        example: '15m',
        default: '15m'
    })
    timeframe?: string;
}