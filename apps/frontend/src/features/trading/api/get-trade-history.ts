import { apiClient } from '@/config/api';
import { ExecutionLog } from '../types';

export const getTradeHistory = async (): Promise<ExecutionLog[]> => {
  try {
    const response = await apiClient.get('/trading/history');
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error('Gagal mengambil trade history', error);
    return [];
  }
};