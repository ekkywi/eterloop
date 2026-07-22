import { useMutation, useQueryClient } from '@tanstack/react-query';
import { closePosition } from '../api/close-position';

export const useClosePosition = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (symbol: string) => closePosition(symbol),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['positions'] });
            queryClient.invalidateQueries({ queryKey: ['trade-history'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-balances'] });
        },
        onError: (error) => {
            console.error('Gagal menutup posisi:', error);
        },
    });
};