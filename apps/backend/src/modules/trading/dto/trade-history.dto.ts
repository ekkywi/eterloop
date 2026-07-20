import { ApiProperty } from '@nestjs/swagger';

export class TradeHistoryDto {
    @ApiProperty({ example: 'uuid-string', description: 'ID riwayat transaksi' })
    id!: string;

    @ApiProperty({ example: 'SOL/USDT' })
    symbol!: string;

    @ApiProperty({ example: 'SELL', description: 'Aksi: BUY atau SELL' })
    action!: string;

    @ApiProperty({ example: 77.69, description: 'Harga saat posisi ditutup' })
    price!: number;

    @ApiProperty({ example: '2026-07-20T23:23:49.000Z' })
    timestamp!: Date;

    @ApiProperty({ 
        example: { 
        trigger: 'CUT LOSS', 
        netPnL: -40.44, 
        netProfitUsdt: -52.57 
    },
    description: 'Data tambahan metrik profit/loss' 
  })
    metadata!: any;
}