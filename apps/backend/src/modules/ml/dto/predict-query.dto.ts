import { ApiProperty } from '@nestjs/swagger';

export class PredictQueryDto {
    @ApiProperty({
        description: 'Simbol koin untuk diprediksi pergerakan harganya',
        example: 'SOL/USDT'
    })
    symbol!: string;
}