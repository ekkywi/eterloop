import { apiClient } from '@/config/api';
import { WalletBalance } from '../types';

export const getBalances = async (mode: 'live' | 'paper'): Promise<WalletBalance[]> => {
  const response = await apiClient.get('/portfolio/balances', {
    params: { mode }
  });
  
  const payload = response.data;

  if (payload && Array.isArray(payload.balances)) {
    return payload.balances;
  }
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;

  console.error('Format respons backend tidak sesuai ekspektasi:', payload);
  return []; 
};