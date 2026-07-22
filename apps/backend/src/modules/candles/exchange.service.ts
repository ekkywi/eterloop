import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as ccxt from 'ccxt';

export interface OhlcvData {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

@Injectable()
export class ExchangeService {

    private readonly logger = new Logger(ExchangeService.name);
    private readonly exchange: ccxt.Exchange;

    constructor() {
        this.exchange = new ccxt.binance({
            enableRateLimit: true,
        });
    }

    async fetchOHLCV(symbol: string, timeframe: string, limit=150): Promise<OhlcvData[]> {
        try {
            const rawData = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);

            return rawData.map((candle) => ({
                timestamp: new Date(candle[0] as number),
                open: candle[1] as number,
                high: candle[2] as number,
                low: candle[3] as number,
                close: candle[4] as number,
                volume: candle[5] as number,
            }));

        } catch (error) {
            this.logger.error(`Gagal mengambil OHLCV untuk ${symbol}: ${error.message}`);
            throw error;
        }
    }

    /**
     * AS-002: fetchTicker sekarang throw error alih-alih mengembalikan data palsu.
     * 
     * CATATAN: Fungsi ini sekarang hanya digunakan untuk operasi yang MEMBUTUHKAN
     * harga real-time akurat (seperti manual close position di TradingController).
     * Dashboard menggunakan MarketDataService cache (WebSocket) — bukan fungsi ini.
     */
    async fetchTicker(symbol: string) {
        try {
            const ticker = await this.exchange.fetchTicker(symbol);
            return {
                price: ticker.last || 0,
                change24h: ticker.percentage || 0,
                volume: ticker.quoteVolume || 0, 
            };
        } catch (error: any) {
            this.logger.error(`Gagal mengambil ticker untuk ${symbol}: ${error.message}`);
            // AS-002: Throw error instead of returning fake data { price: 0, ... }
            throw new HttpException(
                `Gagal mendapatkan harga pasar untuk ${symbol}: ${error.message}`,
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }
}