import { FaSpinner, FaArrowRotateLeft } from 'react-icons/fa6';
import { toToken } from 'satoshi-token';
import { toast } from 'react-hot-toast';
import { useState } from 'react';

interface RefundModalProps {
  onClose: () => void;
  onSuccess: () => void;
  amount: number;
  decimals: number;
  txid: string;
  vout: number;
  customerName?: string;
}

export const RefundModal = ({
  onClose,
  onSuccess,
  amount,
  decimals,
  txid,
  vout,
  customerName = 'your',
}: RefundModalProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleRefund = async () => {
    setIsLoading(true);
    try {
      console.log('Sending refund request:', { txid, vout });
      
      const response = await fetch('/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          txid,
          vout,
        }),
      });

      const data = await response.json();
      console.log('Refund response:', { status: response.status, data });

      if (!response.ok) {
        console.error('Refund failed:', data);
        toast.error(data.error || 'Failed to process refund');
        return;
      }

      toast.success('Refund request created successfully');
      onSuccess();
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

          <div className="alert alert-info">
            <div className="flex flex-col items-start gap-1">
              <div className="font-semibold">Note</div>
              <p className="text-sm">
                This will return the MNEE tokens back to {customerName}'s wallet. The transaction cannot be reversed once confirmed.
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
            disabled={isLoading}
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
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button>close</button>
      </form>
    </dialog>
  );
}; 