import { useQuery } from '@tanstack/react-query';
import { getMarketSignals } from '../api/get-market-signals';
import { useAppStore } from '@/store/useAppStore';
import { MarketSignal } from '../types';

export const useMarketSignals = () => {
    const { isLiveMode } = useAppStore();
    const currentMode = isLiveMode ? 'live' : 'paper';

    return useQuery<MarketSignal[]>({
        queryKey: ['market-signals', currentMode],
        queryFn: () => getMarketSignals(currentMode),
        refetchInterval: 5000,
    });
};