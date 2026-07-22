import { apiClient } from '@/config/api';
import { OpenPosition } from '../types';

export const getPositions = async (): Promise<OpenPosition[]> => {
  try {
    const response = await apiClient.get('/trading/positions');
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error('Gagal mengambil data posisi aktif', error);
    return [];
  }
};