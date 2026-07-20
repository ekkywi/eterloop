import { ApiProperty } from '@nestjs/swagger';

export class WalletBalanceDto {
    @ApiProperty({ example: 'USDT' })
    asset!: string;

    @ApiProperty({ example: 9500 })
    free!: number;

    @ApiProperty({ example: 500 })
    locked!: number;

    @ApiProperty({ example: 10000 })
    total!: number;
}