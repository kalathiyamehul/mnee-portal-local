import { FaSpinner, FaArrowRotateLeft } from 'react-icons/fa6';
import { toToken } from 'satoshi-token';
import { toast } from 'react-hot-toast';
import { useState } from 'react';

interface RefundModalProps {
  onClose: () => void;
  onSuccess: () => void;
  amount: number;
  decimals: number;
  utxo: {
    txid: string;
    vout: number;
  };
  customerName?: string;
}

export const RefundModal = ({
  onClose,
  onSuccess,
  amount,
  decimals,
  utxo,
  customerName = 'the customer',
}: RefundModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [refundAddress, setRefundAddress] = useState('');

  const handleRefund = async () => {
    setIsLoading(true);
    try {
      const outpoint = `${utxo.txid}_${utxo.vout}`;
      console.log('Sending refund request:', { outpoint, refundAddress });
      
      const response = await fetch('/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outpoint, refundAddress }),
      });

      console.log('Refund response:', { status: response.status });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process refund');
      }

      toast.success("Refund request created (pending approval)");
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error refunding burn:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process refund');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <dialog id="refund_modal" className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg flex items-center gap-2 text-primary">
          <FaArrowRotateLeft className="w-4 h-4" /> Confirm Refund
        </h3>
        
        <div className="py-4 space-y-4">
          <div className="bg-base-200 p-4 rounded-lg">
            <div className="text-sm opacity-70 mb-1">Amount to refund</div>
            <div className="text-2xl font-bold">{toToken(amount, decimals)} MNEE</div>
          </div>

          <div className="form-control w-full">
            <label htmlFor="refundAddress" className="label">
              <span className="label-text">Refund Address</span>
              <span className="label-text-alt opacity-70">Where to send the refunded tokens</span>
            </label>
            <input
              id="refundAddress"
              type="text"
              className="input input-bordered w-full"
              value={refundAddress}
              onChange={(e) => setRefundAddress(e.target.value)}
              placeholder="Enter refund address"
              required
            />
          </div>

          <div className="alert alert-info">
            <div className="flex flex-col items-start gap-1">
              <div className="font-semibold">Note</div>
              <p className="text-sm">
                This request will require approval from two administrators before the MNEE tokens are returned to the specified address. The transaction cannot be reversed once confirmed.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-action">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRefund}
            disabled={!refundAddress || isLoading}
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Processing...
              </>
            ) : (
              'Request Refund'
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose} onKeyDown={onClose}>
        <button type="button">close</button>
      </form>
    </dialog>
  );
}; 