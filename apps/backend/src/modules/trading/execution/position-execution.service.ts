import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TRADING_CONFIG } from '../config/trading.config';
import { Prisma } from '@prisma/client';

@Injectable()
export class PositionExecutionService {
  private readonly logger = new Logger(PositionExecutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Buka posisi baru: kurangi balance, lock dana, buat activePosition
   * Versi stand-alone (digunakan oleh RiskManagement dan manual close).
   * Menggunakan SELECT ... FOR UPDATE pada wallet untuk mencegah race condition.
   */
  async openPosition(params: {
    symbol: string;
    currentPrice: number;
    tradeAmount: number;
    quoteAsset: string;
    stopLoss: number;
    takeProfit: number;
    reason: string;
  }): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      await this.openPositionWithTx(tx, params);
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Buka posisi dalam konteks transaksi yang sudah ada (dari DecisionService).
   * RC-004: Mengunci wallet dengan SELECT ... FOR UPDATE untuk mencegah double debit.
   */
  async openPositionWithTx(
    tx: Prisma.TransactionClient,
    params: {
      symbol: string;
      currentPrice: number;
      tradeAmount: number;
      quoteAsset: string;
      stopLoss: number;
      takeProfit: number;
      reason: string;
    },
  ): Promise<void> {
    const { symbol, currentPrice, tradeAmount, quoteAsset, stopLoss, takeProfit, reason } = params;
    const coinQuantity = tradeAmount / currentPrice;

    // RC-004: SELECT ... FOR UPDATE pada wallet untuk mengunci baris
    const lockedWallets: any[] = await tx.$queryRaw(
      Prisma.sql`SELECT * FROM "VirtualWallet" WHERE "asset" = ${quoteAsset} FOR UPDATE`,
    );

    if (lockedWallets.length === 0) {
      throw new Error(`VirtualWallet untuk "${quoteAsset}" tidak ditemukan.`);
    }

    const wallet = lockedWallets[0];
    if (Number(wallet.balance) < tradeAmount) {
      throw new Error(
        `Saldo tidak mencukupi. Butuh $${tradeAmount.toFixed(2)}, tersedia $${Number(wallet.balance).toFixed(2)}.`,
      );
    }

    await tx.virtualWallet.update({
      where: { asset: quoteAsset },
      data: {
        balance: { decrement: tradeAmount },
        locked: { increment: tradeAmount },
      },
    });

    await tx.activePosition.create({
      data: {
        symbol,
        entryPrice: currentPrice,
        stopLossPrice: stopLoss,
        takeProfitPrice: takeProfit,
        investedAmount: tradeAmount,
        coinQuantity: coinQuantity,
      },
    });

    await tx.tradeSimulation.create({
      data: {
        symbol,
        action: 'BUY',
        price: currentPrice,
        metadata: {
          tradeAmount,
          stopLoss,
          takeProfit,
          reason,
        },
      },
    });

    this.logger.log(`[${symbol}] BUY ${coinQuantity.toFixed(6)} koin @ $${currentPrice} | Dana: $${tradeAmount.toFixed(2)}`);
  }

  /**
   * Tutup posisi: hapus activePosition, unlock dana + return profit, catat trade
   * Versi stand-alone (digunakan oleh RiskManagement dan manual close).
   */
  async closePosition(params: {
    symbol: string;
    currentPrice: number;
    quoteAsset: string;
    entryPrice: number;
    investedAmount: number;
    metadata?: Record<string, any>;
  }): Promise<{ netPnL: number; netProfitUsdt: number }> {
    return this.prisma.db.$transaction(async (tx) => {
      return this.closePositionWithTx(tx, params);
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Tutup posisi dalam konteks transaksi yang sudah ada (dari DecisionService/RiskManagement).
   */
  async closePositionWithTx(
    tx: Prisma.TransactionClient,
    params: {
      symbol: string;
      currentPrice: number;
      quoteAsset: string;
      entryPrice: number;
      investedAmount: number;
      metadata?: Record<string, any>;
    },
  ): Promise<{ netPnL: number; netProfitUsdt: number }> {
    const { symbol, currentPrice, quoteAsset, entryPrice, investedAmount, metadata = {} } = params;

    if (!quoteAsset) {
      throw new Error(
        `quoteAsset tidak valid untuk symbol "${symbol}". Pastikan symbol menggunakan format BASE/QUOTE (contoh: BTC/USDT).`,
      );
    }

    // RC-004: SELECT ... FOR UPDATE pada wallet
    const lockedWallets: any[] = await tx.$queryRaw(
      Prisma.sql`SELECT * FROM "VirtualWallet" WHERE "asset" = ${quoteAsset} FOR UPDATE`,
    );

    if (lockedWallets.length === 0) {
      throw new Error(
        `VirtualWallet untuk "${quoteAsset}" tidak ditemukan. Silakan fund terlebih dahulu melalui endpoint fund.`,
      );
    }

    // Cek apakah posisi masih ada (mungkin sudah dihapus oleh concurrent process)
    const existingPosition = await tx.activePosition.findUnique({
      where: { symbol },
    });

    if (!existingPosition) {
      this.logger.warn(`[${symbol}] Posisi sudah tidak ada saat akan ditutup (mungkin sudah ditutup concurrent process).`);
      return { netPnL: 0, netProfitUsdt: 0 };
    }

    const grossPnL = ((currentPrice - entryPrice) / entryPrice) * 100;
    const netPnL = grossPnL - TRADING_CONFIG.ROUND_TRIP_FEE_PCT;
    const netProfitUsdt = investedAmount * (netPnL / 100);
    const amountToReturn = investedAmount + netProfitUsdt;

    await tx.activePosition.delete({
      where: { symbol },
    });

    await tx.virtualWallet.update({
      where: { asset: quoteAsset },
      data: {
        locked: { decrement: investedAmount },
        balance: { increment: amountToReturn },
      },
    });

    await tx.tradeSimulation.create({
      data: {
        symbol,
        action: 'SELL',
        price: currentPrice,
        metadata: {
          grossPnL: Number(grossPnL.toFixed(2)),
          netPnL: Number(netPnL.toFixed(2)),
          netProfitUsdt: Number(netProfitUsdt.toFixed(2)),
          ...metadata,
        },
      },
    });

    this.logger.log(`[${symbol}] SELL @ $${currentPrice} | Net PnL: ${netPnL.toFixed(2)}% ($${netProfitUsdt.toFixed(2)})`);

    return { netPnL, netProfitUsdt };
  }
}