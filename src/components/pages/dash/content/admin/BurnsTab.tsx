import { useEffect, useState, useCallback } from 'react';
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
import { RefundModal } from '../modals/RefundModal';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { useSystemStatus } from '@/contexts/SystemStatusContext';

interface BurnUtxo extends MNEEUtxo {
  burnRequest?: BurnRequest;
}

interface BurnsTabProps {
  showModal: (id: string) => void;
}

export const BurnsTab = ({ showModal }: BurnsTabProps) => {
  const { data: session } = useSession();
  const { statusData } = useSystemStatus();
  const [burns, setBurns] = useState<BurnUtxo[]>([]);
  const [utxos, setUtxos] = useState<MNEEUtxo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [burnAddress, setBurnAddress] = useState<string | null>(null);
  const [decimals, setDecimals] = useState(8);
  const [selectedBurn, setSelectedBurn] = useState<BurnUtxo | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<BurnUtxo | null>(null);

  const fetchConfig = async () => {
    try {
      const configResponse = await fetch('/api/config');
      const config = await configResponse.json();
      if (!config?.burnAddress) {
        throw new Error('Burn address not configured');
      }

      setBurnAddress(config.burnAddress);
      setDecimals(config.decimals || DEFAULT_DECIMALS);
      return config.burnAddress;
    } catch (err) {
      console.error('Error fetching config:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch config');
      return null;
    }
  };

  const fetchUtxos = async (address: string) => {
    try {
      const fetchedUtxos = await fetchMneeUtxos([address]);
      console.log('Burn UTXOs:', fetchedUtxos);
      setUtxos(fetchedUtxos);
    } catch (err) {
      console.error('Error fetching UTXOs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch UTXOs');
    }
  };

  const updateBurns = useCallback(() => {
    if (!utxos.length) return;

    const burnsWithRequests = utxos.map(utxo => {
      const outpoint = `${utxo.txid}_${utxo.vout}`;
      console.log('Checking outpoint:', outpoint);
      const matchingRequest = statusData?.burnRequests?.find((req: BurnRequest) => {
        console.log('Comparing with request:', { 
          requestOutpoint: req.outpoint, 
          matches: req.outpoint === outpoint,
          status: req.status
        });
        return req.outpoint === outpoint;
      });
      console.log('Matching request:', matchingRequest);
      return {
        ...utxo,
        burnRequest: matchingRequest,
      };
    });

    setBurns(burnsWithRequests);
  }, [utxos, statusData?.burnRequests]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    const address = await fetchConfig();
    if (address) {
      await fetchUtxos(address);
    }
    setLoading(false);
  };

  const handleCreateBurnRequest = (burn: BurnUtxo) => {
    setSelectedBurn(burn);
  };

  const handleBurnSuccess = () => {
    setSelectedBurn(null);
  };

  const handleCancelBurn = async (burnId: string) => {
    try {
      const response = await fetch('/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ burnRequestId: burnId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel burn request');
      }

      toast.success('Burn request cancelled');
    } catch (err) {
      console.error('Error cancelling burn:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to cancel burn request');
    }
  };

  const canCancel = (burn: BurnUtxo) => {
    if (!burn.burnRequest || !session?.user?.email) return false;
    return burn.burnRequest.status === 'PENDING' && 
           burn.burnRequest.requester.email === session.user.email;
  };

  const getGravatarUrl = (email: string | undefined) => {
    if (!email) return 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&s=40';
    const hash = md5(email.toLowerCase().trim());
    return `https://www.gravatar.com/avatar/${hash}?d=mp&s=40`;
  };

  const handleRefundSuccess = () => {
    setSelectedRefund(null);
    handleRefresh();
    toast.success('Refund initiated successfully');
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard');
  };

  const handleCopyTxid = (txid: string) => {
    navigator.clipboard.writeText(txid);
    toast.success('Transaction ID copied to clipboard');
  };

  // Initial fetch of config and UTXOs
  useEffect(() => {
    handleRefresh();
  }, []);

  // Update burns when status or UTXOs change
  useEffect(() => {
    updateBurns();
  }, [updateBurns]);

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
                  className="btn btn-ghost btn-xs"
                  title="Copy address"
                >
                  <FaCopy className="w-3 h-3" />
                </button>
                <a
                  href={`https://whatsonchain.com/address/${burnAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-xs"
                  title="View on WhatsOnChain"
                >
                  <MdOutlineOpenInNew className="w-3 h-3" />
                </a>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="btn btn-ghost btn-xs"
                  title="Refresh outputs"
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
                  {burn.burnRequest?.createdAt ? (
                    formatDistanceToNow(new Date(burn.burnRequest.createdAt), { addSuffix: true })
                  ) : (
                    `Block ${burn.height}`
                  )}
                </td>
                <td>
                  {burn.burnRequest ? (
                    <span className={`badge ${
                      burn.burnRequest.status === 'APPROVED' ? 'badge-success' :
                      burn.burnRequest.status === 'REFUNDED' ? 'badge-info' :
                      burn.burnRequest.status === 'PENDING' ? 'badge-ghost' :
                      burn.burnRequest.status === 'CANCELLED' ? 'badge-secondary' :
                      'badge-warning'
                    } badge-sm`}>
                      {burn.burnRequest.status === 'CANCELLED' ? 'AVAILABLE' : burn.burnRequest.status}
                    </span>
                  ) : (
                    <span className="badge badge-secondary badge-sm animate-pulse">NEW</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {(!burn.burnRequest || burn.burnRequest.status === 'CANCELLED') && (
                      <button
                        onClick={() => handleCreateBurnRequest(burn)}
                        className="btn btn-error btn-sm gap-1"
                      >
                        <FaFire className="w-3 h-3" /> Burn
                      </button>
                    )}
                    {canCancel(burn) && (
                      <button
                        onClick={() => handleCancelBurn(burn.burnRequest!.id)}
                        className="btn btn-ghost btn-sm"
                      >
                        Cancel
                      </button>
                    )}
                    {(!burn.burnRequest || !['APPROVED', 'REFUNDED'].includes(burn.burnRequest.status)) && (
                      <button
                        onClick={() => setSelectedRefund(burn)}
                        className="btn btn-primary btn-sm gap-1"
                      >
                        Refund
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedBurn && (
        <BurnModal
          onClose={() => setSelectedBurn(null)}
          onSuccess={handleBurnSuccess}
          amount={selectedBurn.data.bsv21.amt}
          utxo={{
            txid: selectedBurn.txid,
            vout: selectedBurn.vout,
          }}
        />
      )}

      {selectedRefund && (
        <RefundModal
          onClose={() => setSelectedRefund(null)}
          onSuccess={handleRefundSuccess}
          utxo={{
            txid: selectedRefund.txid,
            vout: selectedRefund.vout,
          }}
          amount={selectedRefund.data.bsv21.amt}
          decimals={decimals}
        />
      )}
    </div>
  );
}; 