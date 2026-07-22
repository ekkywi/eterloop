import { apiClient } from '@/config/api';

export const closePosition = async (symbol: string): Promise<void> => {
    const response = await apiClient.post('/trading/position/close', { symbol });
    return response.data;
}