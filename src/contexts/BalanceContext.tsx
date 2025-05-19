"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode, useMemo } from 'react';
import { fetchMneeUtxos , fetchConfig } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { FetchStatus } from '@/types/common';

interface BalanceContextType {
  balances: { [address: string]: number };
  fetchBalance: (address: string) => Promise<void>;
  fetchBalances: (addresses: string[]) => Promise<void>;
  balancesLoading: FetchStatus;
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

export function BalanceProvider({ children }: { children: ReactNode }) {
  const [balances, setBalances] = useState<{ [address: string]: number }>({});
  const [balancesLoading, setBalancesLoading] = useState<FetchStatus>(FetchStatus.IDLE);
  const [burnAddress, setBurnAddress] = useState<string | null>(null);

  const fetchBalance = useCallback(async (address: string) => {
    try {
      setBalancesLoading(FetchStatus.LOADING);
      const utxos = await fetchMneeUtxos([address]);
      const balance = utxos.reduce((amt, o) => amt + (o.data.bsv21.amt || 0), 0);
      
      setBalances(prev => ({
        ...prev,
        [address]: balance
      }));
      setBalancesLoading(FetchStatus.SUCCESS);
    } catch (error) {
      // console.error("Error fetching MNEE balance:", error);
      toast.error("Failed to fetch MNEE balance");
      setBalancesLoading(FetchStatus.ERROR);
    }
  }, []);

  const fetchBalances = useCallback(async (addresses: string[]) => {
    // console.log('fetchBalances called:', {
    //   currentLoadingState: balancesLoading,
    //   addressCount: addresses.length
    // });

    // Skip if already loading
    if (balancesLoading === FetchStatus.LOADING) {
      // console.log('Skipping fetch - already loading');
      return;
    }
    
    try {
      // console.log('Setting loading state...');
      setBalancesLoading(FetchStatus.LOADING);
      
      // console.log('Fetching UTXOs...');
      const utxos = await fetchMneeUtxos(addresses);
      // console.log('UTXOs received:', utxos.length);
      
      const newBalances = addresses.reduce((acc, address) => {
        const addressUtxos = utxos.filter(utxo => utxo.owners[0] === address);
        const balance = addressUtxos.reduce((amt, o) => amt + (o.data.bsv21.amt || 0), 0);
        return { ...acc, [address]: balance };
      }, {});

      // console.log('Setting new balances:', newBalances);
      setBalances(prev => ({
        ...prev,
        ...newBalances
      }));
      
      // console.log('Setting success state...');
      setBalancesLoading(FetchStatus.SUCCESS);
    } catch (error) {
      // console.error("Error fetching MNEE balances:", error);
      toast.error("Failed to fetch MNEE balances");
      // console.log('Setting error state...');
      setBalancesLoading(FetchStatus.ERROR);
    }
  }, [balancesLoading]);

  // Fetch burn address from config and its balance
  useEffect(() => {
    const init = async () => {
      try {
        const config = await fetchConfig();
        if (config?.burnAddress && config.burnAddress !== burnAddress) {
          setBurnAddress(config.burnAddress);
          await fetchBalance(config.burnAddress);
        }
      } catch (error) {
        // console.error("Error fetching config:", error);
        toast.error("Error fetching config");
      }
    };
    init();
  }, [burnAddress, fetchBalance]);

  const value = useMemo(() => ({
    balances,
    fetchBalance,
    fetchBalances,
    balancesLoading
  }), [balances, fetchBalance, fetchBalances, balancesLoading]);

  return (
    <BalanceContext.Provider value={value}>
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance() {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
} 