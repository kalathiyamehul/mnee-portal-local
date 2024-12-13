import { useEffect, useState } from 'react';
import { FaSpinner } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';

interface BurnModalProps {
  onClose: () => void;
  onSuccess: () => Promise<void>;
  txid?: string;
}

interface TxInput {
  txid: string;
  vout: number;
  address: string;
}

export const BurnModal = ({
  onClose,
  onSuccess,
  txid
}: BurnModalProps) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const [refundAddress, setRefundAddress] = useState('');
  const [senderAddress, setSenderAddress] = useState<string | null>(null);

  // When component mounts, fetch and parse the transaction if txid is provided
  useEffect(() => {
    const findSenderAddress = async () => {
      if (!txid) return;
      
      try {
        setLoadingTx(true);

        // Fetch transaction from MNEE cosigner API
        const response = await fetch(`${process.env.NEXT_PUBLIC_MNEE_API}/v1/tx/${txid}`);
        if (!response.ok) {
          console.warn('Transaction not found or API unavailable');
          return;
        }

        const data = await response.json();
        if (!Array.isArray(data) || !data.length || !data[0].rawtx) {
          console.warn('Invalid transaction data format');
          return;
        }

        const [{ rawtx }] = data;
        
        // TODO: Parse rawtx (base64) using bsv library
        // For now, just use a placeholder address
        const placeholderAddress = "1example...";
        setSenderAddress(placeholderAddress);
        if (!refundAddress) {
          setRefundAddress(placeholderAddress);
        }
      } catch (error) {
        console.warn('Error finding sender address:', error);
      } finally {
        setLoadingTx(false);
      }
    };

    findSenderAddress();
  }, [txid, refundAddress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    try {
      setLoading(true);
      const response = await fetch('/api/burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount,
          refundAddress: refundAddress || undefined,
          ...(txid && { txid }) // Only include txid if it exists
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create burn request');
      }

      await onSuccess();
      onClose();
      toast.success('Burn request created');
    } catch (error) {
      console.error('Error creating burn request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create burn request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog id="burn_modal" className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold mb-6">Burn Tokens</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <label className="form-control w-full block">
              <div className="label">
                <span className="label-text">Amount</span>
              </div>
              <input
                type="number"
                className="input input-bordered w-full max-w-md"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount to burn"
                required
              />
            </label>

            {txid && loadingTx && (
              <div className="flex items-center gap-2 text-sm opacity-70">
                <FaSpinner className="animate-spin" />
                Finding sender address...
              </div>
            )}

            {txid && senderAddress && (
              <div className="text-sm opacity-70">
                <p>Found sender address: {senderAddress}</p>
              </div>
            )}

            <label className="form-control w-full block">
              <div className="label">
                <span className="label-text">Refund Address (Optional)</span>
                {txid && <span className="label-text-alt opacity-70">Defaults to sender address if found</span>}
              </div>
              <input
                type="text"
                className="input input-bordered w-full max-w-md"
                value={refundAddress}
                onChange={(e) => setRefundAddress(e.target.value)}
                placeholder="Enter refund address (optional)"
              />
            </label>
          </div>

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading || !amount || (!!txid && loadingTx)}
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}; 