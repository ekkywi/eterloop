import { ApiProperty } from '@nestjs/swagger';

export class SignalQueryDto {
    @ApiProperty({
        description: 'Simbol koin untuk dicek sinyalnya',
        example: 'SOL/USDT'
    })
    symbol!: string;
}