import { useEffect, useState } from 'react';
import { fetchMneeUtxos } from '@/utils/api';
import { FaSpinner, FaFire, FaCopy, FaArrowsRotate } from 'react-icons/fa6';
import { toToken } from 'satoshi-token';
import type { MNEEUtxo } from '@/types';
import { MdOutlineOpenInNew } from 'react-icons/md';
import type { BurnRequest } from './types';
import { DEFAULT_DECIMALS } from '@/lib/constants';
import { formatDistanceToNow } from 'date-fns';
import md5 from 'md5';
import { BurnModal } from '../modals/BurnModal';
import { toast } from 'react-hot-toast';

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
  const [selectedBurn, setSelectedBurn] = useState<BurnUtxo | null>(null);
  const [refundingBurnId, setRefundingBurnId] = useState<string | null>(null);

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

  const handleCreateBurnRequest = (burn: BurnUtxo) => {
    setSelectedBurn(burn);
  };

  const handleBurnSuccess = () => {
    setSelectedBurn(null);
    fetchBurns();
  };

  const getGravatarUrl = (email: string | undefined) => {
    if (!email) return 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&s=40';
    const hash = md5(email.toLowerCase().trim());
    return `https://www.gravatar.com/avatar/${hash}?d=mp&s=40`;
  };

  const handleRefund = async (burn: BurnUtxo) => {
    if (!burn.burnRequest?.id) return;
    
    try {
      setRefundingBurnId(`${burn.txid}_${burn.vout}`);
      const response = await fetch('/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          burnRequestId: burn.burnRequest.id,
          txid: burn.txid,
          vout: burn.vout,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to refund burn');
      }

      toast.success('Refund initiated successfully');
      fetchBurns();
    } catch (error) {
      console.error('Error refunding burn:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to refund burn');
    } finally {
      setRefundingBurnId(null);
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard');
  };

  const handleCopyTxid = (txid: string) => {
    navigator.clipboard.writeText(txid);
    toast.success('Transaction ID copied to clipboard');
  };

  // Initial fetch
  useEffect(() => {
    fetchBurns();
  }, []);

  // Split burns into pending/active and completed
  const activeBurns = burns.filter(burn => !burn.burnRequest || ['PENDING', 'CANCELLED'].includes(burn.burnRequest.status));
  const completedBurns = burns.filter(burn => burn.burnRequest && ['APPROVED', 'REFUNDED'].includes(burn.burnRequest.status));

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Burnable Outputs</h2>
          <p className="text-sm text-base-content/70 mt-1">Send MNEE here to initiate burn</p>
        </div>
        {burnAddress && (
          <div className="w-full sm:w-auto">
            <div className="stat shadow-lg bg-base-100 px-4 sm:px-6 py-3 rounded-2xl relative max-w-[500px]">
              <div className="absolute top-2 right-2 flex items-center gap-1">
                <button
                  onClick={() => handleCopyAddress(burnAddress)}
                  className="btn btn-ghost btn-xs hover:bg-base-200"
                >
                  <FaCopy className="w-3 h-3" />
                </button>
                <a
                  href={`https://whatsonchain.com/address/${burnAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-xs hover:bg-base-200"
                >
                  <MdOutlineOpenInNew className="w-3 h-3" />
                </a>
                <button
                  onClick={fetchBurns}
                  disabled={loading}
                  className="btn btn-ghost btn-xs hover:bg-base-200"
                >
                  {loading ? (
                    <FaSpinner className="w-3 h-3 animate-spin" />
                  ) : (
                    <FaArrowsRotate className="w-3 h-3" />
                  )}
                </button>
              </div>
              <div className="stat-title text-xs uppercase tracking-wider opacity-50">Burn Address</div>
              <div className="stat-value text-base font-mono mt-0.5 pr-24">
                {burnAddress}
              </div>
            </div>
          </div>
        )}
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
            {activeBurns.map((burn) => (
              <tr key={`${burn.txid}_${burn.vout}`} className="hover">
                <td>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">
                      {burn.txid.slice(0, 8)}...{burn.txid.slice(-8)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyTxid(burn.txid)}
                        className="btn btn-ghost btn-xs hover:bg-base-200"
                      >
                        <FaCopy className="w-3 h-3" />
                      </button>
                      <a
                        href={`https://whatsonchain.com/tx/${burn.txid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs hover:bg-base-200"
                      >
                        <MdOutlineOpenInNew className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
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
                      burn.burnRequest.status === 'CANCELLED' ? 'badge-warning' :
                      burn.burnRequest.status === 'REFUNDED' ? 'badge-info' :
                      'badge-ghost'
                    } badge-sm`}>
                      {burn.burnRequest.status}
                    </span>
                  ) : (
                    <span className="badge badge-ghost badge-sm">PENDING</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {!burn.burnRequest && (
                      <button
                        onClick={() => handleCreateBurnRequest(burn)}
                        className="btn btn-error btn-sm gap-1"
                      >
                        <FaFire className="w-3 h-3" /> Burn
                      </button>
                    )}
                    {burn.burnRequest?.status === 'CANCELLED' && (
                      <button
                        onClick={() => handleRefund(burn)}
                        disabled={refundingBurnId === `${burn.txid}_${burn.vout}`}
                        className="btn btn-primary btn-sm gap-1"
                      >
                        {refundingBurnId === `${burn.txid}_${burn.vout}` ? (
                          <>
                            <FaSpinner className="w-3 h-3 animate-spin" />
                            Refunding...
                          </>
                        ) : (
                          <>Refund</>
                        )}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && activeBurns.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-sm text-base-content/70">
                  No pending burns found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="divider my-8" />

      <div>
        <h3 className="text-lg font-semibold mb-4">History</h3>
        <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
          <table className="table">
            <thead>
              <tr>
                <th>Requester</th>
                <th>Transaction</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {completedBurns.map((burn) => (
                <tr 
                  key={`${burn.txid}_${burn.vout}`} 
                  className={`hover border-l-4 ${
                    burn.burnRequest?.status === 'APPROVED' ? 'border-l-success' :
                    burn.burnRequest?.status === 'REFUNDED' ? 'border-l-info' :
                    'border-l-base-300'
                  }`}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="avatar">
                        <div className="mask mask-squircle w-10 h-10">
                          <img
                            src={getGravatarUrl(burn.burnRequest?.requester.email)}
                            alt="User avatar"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">{burn.burnRequest?.requester.email}</div>
                        <div className="text-sm opacity-50">
                          {formatDistanceToNow(new Date(burn.height * 1000), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">
                          {burn.txid.slice(0, 8)}...{burn.txid.slice(-8)}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="tooltip" data-tip="Copy transaction ID">
                            <button
                              onClick={() => handleCopyTxid(burn.txid)}
                              className="btn btn-ghost btn-xs btn-square hover:bg-base-200"
                            >
                              <FaCopy className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="tooltip" data-tip="View on WhatsOnChain">
                            <a
                              href={`https://whatsonchain.com/tx/${burn.txid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-xs btn-square hover:bg-base-200"
                            >
                              <MdOutlineOpenInNew className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${
                          burn.burnRequest?.status === 'APPROVED' ? 'badge-error' :
                          burn.burnRequest?.status === 'REFUNDED' ? 'badge-info' :
                          'badge-ghost'
                        } badge-sm gap-1`}>
                          {burn.burnRequest?.status === 'APPROVED' && <FaFire className="w-3 h-3" />}
                          {burn.burnRequest?.status === 'APPROVED' ? 'Burn' : 'Refunded'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="font-medium">
                    {toToken(burn.data.bsv21.amt, decimals)}
                  </td>
                  <td>
                    <span className={`badge ${
                      burn.burnRequest?.status === 'APPROVED' ? 'badge-success' :
                      burn.burnRequest?.status === 'REFUNDED' ? 'badge-info' :
                      'badge-ghost'
                    } badge-sm`}>
                      {burn.burnRequest?.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && completedBurns.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-sm text-base-content/70">
                    No completed burns found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBurn && (
        <BurnModal
          onClose={() => setSelectedBurn(null)}
          onSuccess={() => {
            setSelectedBurn(null);
            fetchBurns();
          }}
          amount={selectedBurn.data.bsv21.amt}
        />
      )}
    </div>
  );
}; 