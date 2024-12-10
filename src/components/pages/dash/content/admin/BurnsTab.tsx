import { useEffect, useState } from 'react';
import { fetchMneeUtxos } from '@/utils/api';
import { FaSpinner } from 'react-icons/fa6';
import { toToken } from 'satoshi-token';
import type { MNEEUtxo } from '@/types';
import { MdOutlineOpenInNew } from 'react-icons/md';
import { DEFAULT_DECIMALS } from '@/lib/constants';

export const BurnsTab = () => {
  const [burns, setBurns] = useState<MNEEUtxo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [burnAddress, setBurnAddress] = useState<string | null>(null);
  const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);

  const fetchBurns = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch config to get burn address
      const configResponse = await fetch('/api/config');
      const config = await configResponse.json();
      if (!config?.fundAddress) {
        throw new Error('Burn address not configured');
      }

      setBurnAddress(config.fundAddress);
      setDecimals(config.decimals || DEFAULT_DECIMALS);
      // Fetch UTXOs for burn address
      const utxos = await fetchMneeUtxos([config.fundAddress]);
      setBurns(utxos);
    } catch (err) {
      console.error('Error fetching burns:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch burns');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchBurns();
  }, []);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Burns</h2>
          {burnAddress && (
            <a
              href={`https://whatsonchain.com/address/${burnAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-base-content/70 hover:text-primary flex items-center gap-1 mt-1"
            >
              {burnAddress}
              <MdOutlineOpenInNew className="w-3 h-3" />
            </a>
          )}
        </div>
        <button
          onClick={fetchBurns}
          disabled={loading}
          className="btn btn-ghost btn-sm"
        >
          {loading ? <FaSpinner className="animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table table-compact sm:table-normal w-full">
          <thead>
            <tr>
              <th className="text-xs sm:text-sm">Transaction</th>
              <th className="text-xs sm:text-sm">Amount</th>
              <th className="text-xs sm:text-sm">Date</th>
            </tr>
          </thead>
          <tbody>
            {burns.map((burn) => (
              <tr key={`${burn.txid}_${burn.vout}`}>
                <td className="font-mono text-xs sm:text-sm max-w-[120px] sm:max-w-none truncate">
                  <a
                    href={`https://whatsonchain.com/tx/${burn.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary flex items-center gap-1"
                  >
                    {burn.txid}
                    <MdOutlineOpenInNew className="w-3 h-3" />
                  </a>
                </td>
                <td className="text-xs sm:text-sm">
                  {toToken(burn.satoshis, decimals)}
                </td>
                <td className="text-xs sm:text-sm">
                  {new Date(burn.height * 1000).toLocaleString()}
                </td>
              </tr>
            ))}
            {!loading && burns.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-sm text-base-content/70">
                  No burns found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 