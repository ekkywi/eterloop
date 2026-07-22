import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PositionQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveWithPnl() {
    const openPositions = await this.prisma.db.activePosition.findMany();

    if (openPositions.length === 0) {
      return [];
    }

    const positionsWithPnl = await Promise.all(
      openPositions.map(async (pos) => {
        const latestCandle = await this.prisma.db.candle.findFirst({
          where: { symbol: pos.symbol },
          orderBy: { timestamp: 'desc' },
        });

        const currentPrice = latestCandle ? Number(latestCandle.close) : Number(pos.entryPrice);
        const entryPrice = Number(pos.entryPrice);
        const unrealizedPnlPct = ((currentPrice - entryPrice) / entryPrice) * 100;

        return {
          id: pos.id,
          symbol: pos.symbol,
          entryPrice: pos.entryPrice,
          currentPrice,
          invested: Number(pos.investedAmount),
          unrealizedPnlPct: parseFloat(unrealizedPnlPct.toFixed(2)),
          createdAt: pos.createdAt,
        };
      }),
    );

    return positionsWithPnl;
  }
}