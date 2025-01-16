"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchTransaction, ingestTxid } from '@/utils/api';
import toast from 'react-hot-toast';
import { ChooseMode } from './ChooseMode';
import { DeployForm } from './DeployForm';
import { ImportForm } from './ImportForm';
import type { SetupMode } from './types';
import { revalidateConfig } from '@/lib/config';

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
      const [txid, vout] = tokenId.split('_');
      if (!txid || !vout || !Number.isInteger(Number(vout)) || Number(vout) < 0 || txid.length !== 64) {
        toast.error('Invalid token ID');
        return;
      }
      console.log({txid, vout})
      setLoading(true);
      try {
       
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

  const handleDeploy = async (data: { feeAddress: string }) => {
    setLoading(true);
    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to deploy token');
      }
      
      await revalidateConfig();
      console.log("[DEBUG] revalidated config");
      
      toast.success('Token deployed and configured successfully');
      // Signup functionality temporarily disabled
      // router.push('/signup');
      router.push('/login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to deploy token');
      console.error('Error deploying token:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decimals) return;
    
    setLoading(true);
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

      if (!response.ok) throw new Error('Failed to save configuration 2');
      toast.success('Configuration saved successfully');
      // Signup functionality temporarily disabled
      // router.push('/signup');
      router.push('/login');
    } catch (error) {
      toast.error('Failed to save configuration 3');
      console.error('Error saving config:', error);
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