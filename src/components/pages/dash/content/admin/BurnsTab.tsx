import { useEffect, useState } from 'react';
import { fetchMneeUtxos } from '@/utils/api';
import { FaSpinner, FaFire } from 'react-icons/fa6';
import { toToken } from 'satoshi-token';
import type { MNEEUtxo } from '@/types';
import { MdOutlineOpenInNew } from 'react-icons/md';
import type { BurnRequest } from './types';
import { DEFAULT_DECIMALS } from '@/lib/constants';

interface BurnUtxo extends MNEEUtxo {
  burnRequest?: BurnRequest;
}

interface BurnsTabProps {
  showModal: (id: string) => void;
}

export const BurnsTab = ({ showModal }: BurnsTabProps) => {
  const [burns, setBurns] = useState<BurnUtxo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [burnAddress, setBurnAddress] = useState<string | null>(null);
  const [decimals, setDecimals] = useState(8);

  const fetchBurns = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch config to get burn address
      const configResponse = await fetch('/api/config');
      const config = await configResponse.json();
      if (!config?.burnAddress) {
        throw new Error('Burn address not configured');
      }

      setBurnAddress(config.burnAddress);
      setDecimals(config.decimals || DEFAULT_DECIMALS);
      
      // Fetch UTXOs for burn address
      const utxos = await fetchMneeUtxos([config.burnAddress]);

      // Fetch burn requests to match with UTXOs
      const statusResponse = await fetch('/api/status');
      const status = await statusResponse.json();
      const burnRequests = status.burnRequests || [];

      // Match UTXOs with burn requests
      const burnsWithRequests = utxos.map(utxo => ({
        ...utxo,
        burnRequest: burnRequests.find((req: BurnRequest) => 
          // TODO: Add outpoint to burn request to match with UTXO
          req.amount === utxo.satoshis.toString()
        ),
      }));

      setBurns(burnsWithRequests);
    } catch (err) {
      console.error('Error fetching burns:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch burns');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBurnRequest = async () => {
    showModal('burn_modal');
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

      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {burns.map((burn) => (
              <tr key={`${burn.txid}_${burn.vout}`} className="hover">
                <td>
                  <a
                    href={`https://whatsonchain.com/tx/${burn.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm link link-hover flex items-center gap-1"
                  >
                    {burn.txid.slice(0, 8)}...{burn.txid.slice(-8)}
                    <MdOutlineOpenInNew className="w-3 h-3" />
                  </a>
                </td>
                <td className="font-medium">
                  {toToken(burn.data.bsv21.amt, decimals)}
                </td>
                <td className="text-sm text-base-content/70">
                  {new Date(burn.height * 1000).toLocaleString()}
                </td>
                <td>
                  {burn.burnRequest ? (
                    <span className={`badge ${
                      burn.burnRequest.status === 'APPROVED' ? 'badge-success' :
                      burn.burnRequest.status === 'PENDING' ? 'badge-warning' :
                      'badge-error'
                    } badge-sm`}>
                      {burn.burnRequest.status}
                    </span>
                  ) : (
                    <span className="text-base-content/50 text-sm">No request</span>
                  )}
                </td>
                <td>
                  {!burn.burnRequest && (
                    <button
                      onClick={() => handleCreateBurnRequest()}
                      className="btn btn-error btn-sm"
                    >
                      <FaFire className="w-3 h-3 mr-1" /> Burn
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && burns.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-sm text-base-content/70">
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