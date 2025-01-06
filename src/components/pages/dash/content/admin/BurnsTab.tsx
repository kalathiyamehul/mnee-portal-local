import { useEffect, useState, useCallback } from 'react';
import { fetchMneeUtxos } from '@/utils/api';
import { FaSpinner, FaFire, FaCopy, FaArrowsRotate, FaCircleInfo } from 'react-icons/fa6';
import { toToken } from 'satoshi-token';
import type { MNEEUtxo } from '@/types';
import { MdOutlineOpenInNew } from 'react-icons/md';
import type { BurnUtxo } from './types';
import { DEFAULT_DECIMALS } from '@/lib/constants';
import { formatDistanceToNow } from 'date-fns';
import { BurnModal } from '../modals/BurnModal';
import { RefundModal } from '../modals/RefundModal';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { useSystemStatus } from '@/contexts/SystemStatusContext';
import { BurnTable } from './BurnTable';

const getRowBorderClass = (status: string | undefined) => {
  switch (status) {
    case 'PENDING':
      return 'border-l-4 border-l-warning';
    case 'APPROVED':
      return 'border-l-4 border-l-success';
    case 'REFUNDED':
      return 'border-l-4 border-l-info';
    case 'CANCELLED':
      return 'border-l-4 border-l-error';
    default:
      return 'border-l-4 border-l-secondary';
  }
};

export const BurnsTab = () => {
  const { data: session } = useSession();
  const { statusData } = useSystemStatus();
  const [burns, setBurns] = useState<BurnUtxo[]>([]);
  const [burnUtxos, setBurnUtxos] = useState<MNEEUtxo[]>([]);
  const [utxos, setUtxos] = useState<MNEEUtxo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [burnAddress, setBurnAddress] = useState<string | null>(null);
  const [decimals, setDecimals] = useState(8);
  const [selectedBurn, setSelectedBurn] = useState<BurnUtxo | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<BurnUtxo | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const configResponse = await fetch('/api/config');
      const config = await configResponse.json();
      if (!config?.burnAddress) {
        throw new Error('Burn address not configured');
      }

      console.log('Config loaded:', { config, decimals: config.decimals });
      setBurnAddress(config.burnAddress);
      setDecimals(config.decimals ?? DEFAULT_DECIMALS);
      return config.burnAddress;
    } catch (err) {
      console.error('Error fetching config:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch config');
      return null;
    }
  }, []);

  const fetchUtxos = useCallback(async (address: string) => {
    try {
      // defaults to transfer and deploy+mint if not specified
      const fetchedTransferUtxos = await fetchMneeUtxos([address]);
      console.log('Transfer UTXOs:', fetchedTransferUtxos);
      setUtxos(fetchedTransferUtxos);

      // burns only
      const fetchedBurnUtxos = await fetchMneeUtxos([address], ['burn']);
      console.log('Burn UTXOs:', fetchedBurnUtxos);
      setBurnUtxos(fetchedBurnUtxos);
    } catch (err) {
      console.error('Error fetching UTXOs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch UTXOs');
    }
  }, []);

  // update burns with requests
  const updateBurns = useCallback(() => {
    console.log('Updating burns with:', {
      utxos,
      burnUtxos,
      burnRequests: statusData?.burnRequests
    });

    // Only use transfer UTXOs for burn requests
    const burnsWithRequests = utxos.map(utxo => ({
      ...utxo,
      burnRequest: statusData?.burnRequests?.find(req => req.outpoint === `${utxo.txid}_${utxo.vout}`)
    }));

    // Add burn UTXOs with APPROVED status
    for (const utxo of burnUtxos) {
      burnsWithRequests.push({
        ...utxo,
        burnRequest: {
          id: `${utxo.txid}_${utxo.vout}`,
          type: 'BURN',
          status: 'APPROVED',
          amount: utxo.data.bsv21.amt.toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          requestedBy: 'system',
          approvals: [],
          requester: { name: 'Unknown', email: 'unknown@example.com' }
        }
      });
    }

    console.log('Final burns:', burnsWithRequests);
    setBurns(burnsWithRequests as BurnUtxo[]);
  }, [utxos, burnUtxos, statusData?.burnRequests]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const address = await fetchConfig();
    if (address) {
      await fetchUtxos(address);
    }
    setLoading(false);
  }, [fetchUtxos, fetchConfig]);

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
    if (!burnAddress) {
      handleRefresh();
    }
  }, [burnAddress, handleRefresh]);

  // Update burns when status or UTXOs change
  useEffect(() => {
    console.log('Updating burns with decimals:', decimals);
    updateBurns();
  }, [updateBurns, decimals]);

  // Split burns into pending/active and completed
  const activeBurns = burns.filter(burn => !burn.burnRequest || ['PENDING', 'CANCELLED'].includes(burn.burnRequest.status));
  const completedBurns = burns.filter(burn => burn.burnRequest && ['APPROVED', 'REFUNDED'].includes(burn.burnRequest.status));

  return (
    <div className="p-4 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Burn Requests</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          {decimals === 0 && (
            <div className="alert alert-warning">
              <span>Warning: Token decimals not properly configured</span>
            </div>
          )}

          <div className="bg-base-100 rounded-lg">
            <div className="overflow-x-auto">
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
                    <tr 
                      key={`${burn.txid}_${burn.vout}_${burn.burnRequest?.id || 'new'}_${burn.burnRequest?.createdAt || Date.now()}`} 
                      className={`hover ${getRowBorderClass(burn.burnRequest?.status)}`}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {burn.txid.slice(0, 8)}...{burn.txid.slice(-8)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyTxid(burn.txid)}
                              className="btn btn-ghost btn-xs btn-square"
                            >
                              <FaCopy className="w-3 h-3" />
                            </button>
                            <a
                              href={`https://whatsonchain.com/tx/${burn.txid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-xs btn-square"
                            >
                              <MdOutlineOpenInNew className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="font-medium">
                        {toToken(burn.data.bsv21.amt, decimals)} MNEE
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
                              type="button"
                              onClick={() => handleCreateBurnRequest(burn)}
                              className="btn btn-error btn-sm gap-1"
                            >
                              <FaFire className="w-3 h-3" /> Burn
                            </button>
                          )}
                          {canCancel(burn) && (
                            <button
                              type="button"
                              onClick={() => burn.burnRequest && handleCancelBurn(burn.burnRequest.id)}
                              className="btn btn-ghost btn-sm"
                            >
                              Cancel
                            </button>
                          )}
                          {(!burn.burnRequest || !['APPROVED', 'REFUNDED'].includes(burn.burnRequest?.status)) && (
                            <button
                              type="button"
                              onClick={() => setSelectedRefund(burn)}
                              className="btn btn-primary btn-sm gap-1"
                              disabled={burn.burnRequest?.status === 'PENDING'}
                              title={burn.burnRequest?.status === 'PENDING' ? 'Cancel burn request first' : undefined}
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
          </div>

          <BurnTable 
            title="Burn History"
            burns={completedBurns}
            decimals={decimals}
            onCopyTxid={handleCopyTxid}
            alwaysShow={true}
          />
        </div>

        {burnAddress && (
          <div className="lg:col-span-1">
            <div className="bg-base-200 rounded-lg p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs uppercase tracking-wider opacity-50">Burn Address</div>
                  <div className="text-xs text-base-content/70 flex items-center gap-2 mt-1">
                    <FaCircleInfo className="w-3 h-3" />
                    <span>Send tokens to burn</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopyAddress(burnAddress)}
                    className="btn btn-ghost btn-xs btn-square"
                    title="Copy address"
                  >
                    <FaCopy className="w-3 h-3" />
                  </button>
                  <a
                    href={`https://whatsonchain.com/address/${burnAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-xs btn-square"
                    title="View on WhatsOnChain"
                  >
                    <MdOutlineOpenInNew className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={loading}
                    className="btn btn-ghost btn-xs btn-square"
                    title="Refresh outputs"
                  >
                    {loading ? (
                      <FaSpinner className="w-3 h-3 animate-spin" />
                    ) : (
                      <FaArrowsRotate className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <div className="font-mono text-xs break-all">
                {burnAddress}
              </div>

              <div className="divider my-2" />

              <div>
                <div className="text-xs uppercase tracking-wider opacity-50 mb-2">Current Balance</div>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    `${toToken(utxos.reduce((total, utxo) => total + Number(utxo.data.bsv21.amt), 0).toString(), decimals)} MNEE`
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
          decimals={decimals}
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