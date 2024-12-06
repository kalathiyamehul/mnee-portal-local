"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchTransaction, ingestTxid } from '@/utils/api';
import toast from 'react-hot-toast';
import { ChooseMode } from './ChooseMode';
import { DeployForm } from './DeployForm';
import { ImportForm } from './ImportForm';
import type { SetupMode } from './types';

// Default fees that will be used during setup
const DEFAULT_FEES = [
  { min: 0, max: 10000, fee: 50 },
  { min: 10001, max: Number.MAX_SAFE_INTEGER, fee: 1000 },
];

export default function Setup() {
  const router = useRouter();
  const [mode, setMode] = useState<SetupMode>('choose');
  const [loading, setLoading] = useState(false);
  const [tokenId, setTokenId] = useState('');
  const [decimals, setDecimals] = useState<number | null>(null);
  const [feeAddress, setFeeAddress] = useState('');
  const [latestMinterTx, setLatestMinterTx] = useState<string | null>(null);

  // Effect to fetch token details when tokenId changes
  useEffect(() => {
    const fetchTokenDetails = async () => {
      if (!tokenId) return;
      
      setLoading(true);
      try {
        const [txid, vout] = tokenId.split('_');
        const data = await ingestTxid(txid);
        const token = data.txos[Number.parseInt(vout)].data.bsv21;
        setDecimals(token.dec);
        const tx = await fetchTransaction(txid);
        setLatestMinterTx(tx.toHex());
        toast.success('Token details fetched successfully');
      } catch (error) {
        toast.error('Failed to fetch token details');
        console.error('Error fetching token:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTokenDetails();
  }, [tokenId]);

  const handleDeploy = async (data: { 
    symbol: string; 
    amount: string; 
    decimals: number; 
    feeAddress: string;
  }) => {
    setLoading(true);
    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          amount: Number.parseInt(data.amount),
        }),
      });

      if (!response.ok) throw new Error('Failed to deploy token');
      const responseData = await response.json();
      
      // Set all the config values from the deploy response and form data
      setTokenId(responseData.tokenId);
      setDecimals(data.decimals);
      setFeeAddress(data.feeAddress);
      setLatestMinterTx(responseData.latestMinterTx);
      
      // Save the config immediately after successful deployment
      await saveConfig();
      
      toast.success('Token deployed and configured successfully');
      router.push('/dash');
    } catch (error) {
      toast.error('Failed to deploy token');
      console.error('Error deploying token:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenId,
          decimals,
          feeAddress,
          fees: DEFAULT_FEES,
          latestMinterTx,
        }),
      });

      if (!response.ok) throw new Error('Failed to save configuration');
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decimals) return;
    
    setLoading(true);
    try {
      await saveConfig();
      toast.success('Configuration saved successfully');
      router.push('/dash');
    } catch (error) {
      toast.error(`Failed to save configuration: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Render the appropriate step
  if (mode === 'choose') {
    return <ChooseMode onModeSelect={setMode} />;
  }

  if (mode === 'deploy') {
    return (
      <DeployForm
        onBack={() => setMode('choose')}
        onDeploy={handleDeploy}
        loading={loading}
      />
    );
  }

  return (
    <ImportForm
      onBack={() => setMode('choose')}
      tokenId={tokenId}
      decimals={decimals}
      feeAddress={feeAddress}
      loading={loading}
      onTokenIdChange={setTokenId}
      onFeeAddressChange={setFeeAddress}
      onSubmit={handleImportSubmit}
    />
  );
} 