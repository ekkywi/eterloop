import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetFeaturesQueryDto {
    @ApiProperty({ description: 'Simbol koin untuk dicek indikator', example: 'SOL/USDT' })
    symbol!: string;
}