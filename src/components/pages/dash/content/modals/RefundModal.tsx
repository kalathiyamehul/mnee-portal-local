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
      console.log('Creating refund request:', { outpoint, refundAddress });
      
      const response = await fetch('/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outpoint, refundAddress }),
      });

      console.log('Refund response:', { status: response.status });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create refund request');
      }

      toast.success("Refund request created (pending approval)");
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating refund request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create refund request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <dialog id="refund_modal" className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg flex items-center gap-2 text-primary">
          <FaArrowRotateLeft className="w-4 h-4" /> Request Refund
        </h3>
        <p className="py-4">
          You are about to request a refund of {toToken(amount, decimals)} MNEE to {customerName}.
          This request will require approval from two administrators.
        </p>
        <div className="form-control w-full">
          <label htmlFor="refundAddress" className="label">
            <span className="label-text">Refund Address</span>
          </label>
          <input
            id="refundAddress"
            type="text"
            placeholder="Enter refund address"
            className="input input-bordered w-full"
            value={refundAddress}
            onChange={(e) => setRefundAddress(e.target.value)}
          />
          <label htmlFor="refundAddress" className="label">
            <span className="label-text-alt">The address where the tokens will be sent</span>
          </label>
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
            disabled={isLoading || !refundAddress}
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Creating Request...
              </>
            ) : (
              'Create Request'
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}; 