import { apiClient } from '@/config/api';
import { MarketSignal } from '../types';

export const getMarketSignals = async (): Promise<MarketSignal[]> => {
  try {
    // PERBAIKAN: Gunakan '/trading/overview' tanpa awalan '/api'
    const response = await apiClient.get('/trading/overview');
    
    const payload = response.data;
    if (payload && Array.isArray(payload.data)) {
      return payload.data;
    }
    
    return [];
  } catch (error) {
    console.error('Gagal menarik data overview dashboard', error);
    return [];
  }
};