import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TradeHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecent(limit: number = 100) {
    const history = await this.prisma.db.tradeSimulation.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return history.map((record) => ({
      id: record.id,
      symbol: record.symbol,
      action: record.action,
      price: Number(record.price),
      timestamp: record.timestamp,
      metadata: record.metadata,
    }));
  }
}