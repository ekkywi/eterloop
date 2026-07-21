import { ApiProperty } from '@nestjs/swagger';

export class ActivePositionDto {
  @ApiProperty({ example: '1234-abcd-5678-efgh', description: 'ID unik posisi' })
  id!: string;

  @ApiProperty({ example: 'SOL/USDT', description: 'Pasangan koin yang sedang ditradingkan' })
  symbol!: string;

  @ApiProperty({ example: 145.50, description: 'Harga beli rata-rata (Entry)' })
  entryPrice!: number;

  @ApiProperty({ example: 150.00, description: 'Harga pasar terakhir (Current Price)' })
  currentPrice!: number;

  @ApiProperty({ example: 50.00, description: 'Jumlah modal (USDT) yang dikunci dalam posisi ini' })
  invested!: number;

  @ApiProperty({ example: 3.09, description: 'Persentase keuntungan/kerugian sementara (%)' })
  unrealizedPnlPct!: number;

  @ApiProperty({ example: '2026-07-20T14:00:00.000Z' })
  createdAt!: Date;
}