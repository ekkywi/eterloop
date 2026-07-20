import { ApiProperty } from '@nestjs/swagger';

export class FundWalletDto {
    @ApiProperty({
        description: 'Simbol aset yang ingin ditambahkan (misal: USDT, USDC)',
        example: 'USDT',
    })
    asset!: string;

    @ApiProperty({
        description: 'Jumlah saldo virtual yang ingin disuntikkan',
        example: 10000,
    })
    amount!: number;
}