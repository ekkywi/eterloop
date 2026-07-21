'use client'

import { useAppStore } from '@/store/useAppStore';
import { useBalances } from '@/features/portfolio/hooks/use-balances';
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';

export function Navbar() {
    const { isLiveMode, toggleMode } = useAppStore();
    const { data: balances, isLoading, isError } = useBalances();
    const usdtWallet = balances?.find((b) => b.asset === 'USDT');
    const totalUsdt = usdtWallet ? usdtWallet.total : 0;

    let displayBalance = '$0.00';
    if (isLoading) displayBalance = '...';
    if (isError) displayBalance = 'ERROR';
    if (usdtWallet) displayBalance = `$${totalUsdt.toFixed(2)}`;


    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background-60">
            <div className="flex h-14 w-full items-center justify-between px-6 lg:px-8">

                {/* Kiri: Logo dan Identitas */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 font-bold font-mono text-lg tracking-wider">
                        <Activity className="h-5 w-5 text-primary" />
                            <span>ETERLOOP</span>
                    </div>
                    <Badge variant={isLiveMode ? "destructive" : "secondary"} className="uppercase text-[10px] font-mono tracking-widest">
                        {isLiveMode ? 'Live Trading' : 'Paper Trading'}
                    </Badge>
                </div>

                {/* Kanan: Global Controls */}
                <div className="flex items-center gap-6">

                    {/* toggle Environment */}
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono uppercase ${!isLiveMode ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                            Paper
                        </span>
                        <Switch
                            checked={isLiveMode}                        
                            onCheckedChange={toggleMode}
                            className={isLiveMode ? "data-[state=checked]:bg-destructive" : ""}
                        >
                        </Switch>
                        <span className={`text-xs font-mono uppercase ${isLiveMode ? 'text-destrucive font-bold' : 'text-muted-foreground'}`}>
                            Live
                        </span>
                    </div>

                    {/* Saldo Wallet */}
                    <div className="flex flex-col items-end text-sm">
                        <span className="text-muted-foreground text-[10px] font-mono uppercase tracking-wider">
                            Total Balance
                        </span>
                        <span className="font-mono font-medium">
                            {displayBalance}
                        </span>
                    </div>

                </div>

            </div>
        </header>
    );
}