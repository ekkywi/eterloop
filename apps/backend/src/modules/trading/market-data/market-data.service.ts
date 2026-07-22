import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface PriceTick {
  symbol: string;       // format database: BASE/QUOTE
  price: number;
  change24h: number;
  volume: number;
  timestamp: number;
}

/**
 * MarketDataService — Single WebSocket gateway ke Binance miniTicker 24hr.
 * Menyediakan stream harga real-time untuk seluruh aplikasi.
 *
 * RC-005 & AS-001: Data WebSocket ini menggantikan REST API polling fetchTicker()
 * dari DashboardService, menghilangkan risiko rate limit Binance.
 *
 * Konsumen:
 *   - RiskManagementService (via EventEmitter)
 *   - DashboardService (via in-memory cache)
 *   - Future: SSE/Socket.io ke frontend
 */
@Injectable()
export class MarketDataService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketDataService.name);

  private ws!: WebSocket;
  private reconnectTimeout!: NodeJS.Timeout;
  private pingInterval!: NodeJS.Timeout;

  private binanceToDbSymbol: Map<string, string> = new Map();

  // In-memory cache harga terkini per symbol
  private priceCache: Map<string, PriceTick> = new Map();

  // Debug counter
  private _msgCount = 0;

  // Konfigurasi reconnect dengan exponential backoff
  private reconnectAttempt = 0;
  private readonly MAX_RECONNECT_DELAY = 60000; // 60 detik maksimum
  private readonly BASE_RECONNECT_DELAY = 2000;  // 2 detik awal
  private readonly HEARTBEAT_INTERVAL = 180000;  // 3 menit (Binance rekomendasi)

  constructor(private readonly prisma: PrismaService) {
    super();
    this.setMaxListeners(50); // Banyak listener untuk banyak market
  }

  async onModuleInit() {
    await this.connectWebSocket();
  }

  onModuleDestroy() {
    this.cleanup();
  }

  /**
   * Dapatkan harga terkini dari cache (read-only, instant).
   * Digunakan oleh DashboardService untuk menggantikan fetchTicker() REST call.
   */
  getCachedPrice(symbol: string): PriceTick | null {
    return this.priceCache.get(symbol) || null;
  }

  /**
   * Dapatkan semua harga dari cache.
   */
  getAllCachedPrices(): PriceTick[] {
    return Array.from(this.priceCache.values());
  }

  private async connectWebSocket() {
    const activeMarkets = await this.prisma.db.marketConfig.findMany({
      where: { isActive: true },
    });

    if (activeMarkets.length === 0) {
      this.logger.warn('Tidak ada koin aktif di MarketConfig. WebSocket diam. Retry dalam 10 detik...');
      this.scheduleReconnect(10000);
      return;
    }

    const streams: string[] = [];
    this.binanceToDbSymbol.clear();

    for (const market of activeMarkets) {
      const dbSymbol = market.symbol;

      const parts = dbSymbol.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        this.logger.warn(`[${dbSymbol}] Format symbol tidak valid (harus BASE/QUOTE). Dilewati.`);
        continue;
      }

      const binanceSymbol = dbSymbol.replace('/', '');
      // RC-005: Gunakan miniTicker 24hr — ringan dan cukup untuk harga + perubahan 24h
      const streamName = `${binanceSymbol.toLowerCase()}@miniTicker`;
      streams.push(streamName);
      this.binanceToDbSymbol.set(binanceSymbol, dbSymbol);
    }

    if (streams.length === 0) {
      this.logger.warn('Tidak ada stream yang valid. WebSocket diam.');
      return;
    }

    const streamPath = streams.join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamPath}`;
    this.logger.log(`[MarketData] Menghubungkan ke Binance WS untuk ${streams.length} pair(s)...`);

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      this.logger.log(`✅ [MarketData] WebSocket Aktif! (${streams.length} pairs)`);
      this.reconnectAttempt = 0;

      // RC-009: Setup heartbeat ping setiap 3 menit
      this.startHeartbeat();
    });

    this.ws.on('message', (data: string) => {
      try {
        const rawParsed = JSON.parse(data);
        const parsed = rawParsed.data || rawParsed;

        if (!parsed.c || !parsed.s) {
          this.logger.warn(`[MarketData] Skipping message - missing c or s. Keys: ${Object.keys(parsed).join(', ')}`);
          return;
        }

        const price = parseFloat(parsed.c);
        // NOTE: @miniTicker does NOT include 'P' (percent change). 
        // Calculate change24h from close (c) and open (o) prices.
        const openPrice = parseFloat(parsed.o || '0');
        const rawChange = openPrice > 0 ? ((price - openPrice) / openPrice) * 100 : 0;
        const change24h = Math.round(rawChange * 100) / 100;
        const volume = parseFloat(parsed.q || '0');
        const binanceSymbol = parsed.s;

        const dbSymbol = this.binanceToDbSymbol.get(binanceSymbol);
        if (!dbSymbol) {
          this.logger.warn(`[MarketData] No dbSymbol mapping for Binance symbol: ${binanceSymbol}`);
          return;
        }

        const tick: PriceTick = {
          symbol: dbSymbol,
          price,
          change24h,
          volume,
          timestamp: Date.now(),
        };

        // Update in-memory cache
        this.priceCache.set(dbSymbol, tick);

        // Emit event untuk subscriber (RiskManagementService, dll)
        this.emit(`price:${dbSymbol}`, tick);
        this.emit('price:all', tick);

      } catch (error) {
        this.logger.error('[MarketData] Gagal parsing data WebSocket', error);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.logger.warn(`[MarketData] WebSocket Terputus! (code: ${code}, reason: ${reason?.toString() || 'none'})`);
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.ws.on('error', (error) => {
      this.logger.error(`[MarketData] WebSocket Error: ${error.message}`);
      this.stopHeartbeat();
      // Jangan panggil close() di sini — 'close' event akan terpicu otomatis setelah error
    });

    // RC-009: Handle pong response
    this.ws.on('pong', () => {
      this.logger.debug('[MarketData] Heartbeat pong diterima');
    });
  }

  /**
   * RC-009: Kirim ping frame secara berkala untuk mendeteksi silent disconnection.
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.logger.debug('[MarketData] Heartbeat ping dikirim');
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined!;
    }
  }

  /**
   * RC-008: Exponential backoff untuk reconnect.
   */
  private scheduleReconnect(delay?: number) {
    clearTimeout(this.reconnectTimeout);

    let reconnectDelay: number;
    if (delay !== undefined) {
      reconnectDelay = delay;
    } else {
      reconnectDelay = Math.min(
        this.BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempt),
        this.MAX_RECONNECT_DELAY,
      );
      this.reconnectAttempt++;
    }

    this.logger.log(`[MarketData] Reconnect dalam ${reconnectDelay / 1000} detik (attempt #${this.reconnectAttempt})...`);

    this.reconnectTimeout = setTimeout(() => {
      this.logger.log('[MarketData] Mencoba reconnect...');
      this.connectWebSocket();
    }, reconnectDelay);
  }

  private cleanup() {
    this.stopHeartbeat();
    clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      // Hapus listener untuk mencegah memory leak
      this.ws.removeAllListeners();
      this.ws.close();
    }
    this.removeAllListeners();
  }
}