import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { WalletBalanceDto } from './dto/wallet-balance.dto';

@Injectable()
export class PortfolioService {
    constructor(private readonly prisma: PrismaService) {}

    async fundPaperWallet(asset: string, amount: number) {
        const wallet = await this.prisma.db.virtualWallet.upsert({
            where: { asset: asset },
            update: { balance: { increment: amount } },
            create: { asset: asset, balance: amount, locked: 0 }
        })

        return wallet;
    }

    async getBalance(mode: string): Promise<WalletBalanceDto[]> {
        if (mode === 'live') {
            // TODO: Integrasi dengan Binance API (CCXT/Modul http)
            throw new NotImplementedException('Live trading belum diimplementasikan. Gunakan mode paper.');
        }
        return this.getPaperBalance();
    }

    private async getPaperBalance(): Promise<WalletBalanceDto[]> {
        const wallets = await this.prisma.db.virtualWallet.findMany();

        return wallets.map(wallet => ({
            asset: wallet.asset,
            free: wallet.balance,
            locked: wallet.locked,
            total: wallet.balance + wallet.locked
        }));
    }
}