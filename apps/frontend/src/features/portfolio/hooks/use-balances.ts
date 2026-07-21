import { useQuery } from '@tanstack/react-query';
import { getBalances } from '../api/get-balances';
import { useAppStore } from '@/store/useAppStore';
import { WalletBalance } from '../types';

export const useBalances = () => {
  const { isLiveMode } = useAppStore();
  const currentMode = isLiveMode ? 'live' : 'paper';

  return useQuery<WalletBalance[]>({
    queryKey: ['balances', currentMode],
    queryFn: () => getBalances(currentMode), 
    refetchInterval: 10000,
  });
};