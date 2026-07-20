import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';
import { FundWalletDto } from './dto/fund-wallet.dto';

@ApiTags('Portfolio (Paper Trading)')
@Controller('api/portfolio')
export class PortfolioController {
    constructor(private readonly portfolioService: PortfolioService) {}

    @Get('balances')
    @ApiOperation({ summary: 'Lihat saldo Virtual Wallet' })
    async getWalletBalances(@Query('mode') mode: string = 'paper') {
        const balances = await this.portfolioService.getBalance(mode);
        
        return {
            mode: mode,
            timestamp: new Date().toISOString(),
            balances: balances
        };
    }

    @Post('fund')
    @ApiOperation({ summary: 'Top-up saldo Virtual Wallet (Mesin Cetak Uang)' })
    async fundWallet(@Body() body: FundWalletDto) { // <-- Menggunakan DTO di sini
        if (!body.asset || !body.amount) {
            return { error: 'Harap sertakan asset dan amount di body request.' };
        }

        const result = await this.portfolioService.fundPaperWallet(body.asset, body.amount);
        
        return {
            message: `Berhasil menambahkan ${body.amount} ${body.asset} ke Paper Wallet!`,
            wallet: result
        };
    }
}