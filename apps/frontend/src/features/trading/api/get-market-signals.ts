import { apiClient } from '@/config/api';
import { MarketSignal } from '../types';

export const getMarketSignals = async (mode: 'live' | 'paper'): Promise<MarketSignal[]> => {
    const response = await apiClient.get('/trading/signals', {
        params: { mode }
    });

    const payload = response.data;

    if (payload && Array.isArray(payload.data)) {
        return payload.data;
    }
    if (Array.isArray(payload)) {
        return payload;
    }

    console.error('Format respons signals tidak valid:', payload);
    return [];
}