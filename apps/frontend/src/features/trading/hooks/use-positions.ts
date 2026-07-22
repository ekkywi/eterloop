import { useQuery } from '@tanstack/react-query';
import { getPositions } from '../api/get-positions';
import { OpenPosition } from '../types';

export const usePositions = () => {
  return useQuery<OpenPosition[]>({
    queryKey: ['positions'],
    queryFn: () => getPositions(),
    refetchInterval: 5000,
  });
};