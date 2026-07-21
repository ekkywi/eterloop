import { create} from 'zustand';

interface AppState {
    isLiveMode: boolean;
    toggleMode: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    isLiveMode: false,
    toggleMode: () => set((state) => ({ isLiveMode: !state.isLiveMode })),
}));