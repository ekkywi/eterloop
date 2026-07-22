import { useQuery } from '@tanstack/react-query';
import { getTradeHistory } from '../api/get-trade-history';
import { ExecutionLog } from '../types';

export const useTradeHistory = () => {
  return useQuery<ExecutionLog[]>({
    queryKey: ['trade-history'],
    queryFn: () => getTradeHistory(),
    refetchInterval: 5000,
  });
};