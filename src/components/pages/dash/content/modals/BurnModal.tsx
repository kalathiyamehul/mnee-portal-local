import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { FaSpinner, FaFire } from 'react-icons/fa6';
import { toToken } from 'satoshi-token';

interface BurnModalProps {
  onClose: () => void;
  onSuccess: () => void;
  amount: number;
}

export function BurnModal({ onClose, onSuccess, amount }: BurnModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!amount) return;

    try {
      setLoading(true);
      const response = await fetch('/api/burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amount.toString() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create burn request');
      }

      toast.success('Burn request created');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating burn request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create burn request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg flex items-center gap-2 text-error">
          <FaFire className="w-4 h-4" /> Confirm Token Burn
        </h3>
        
        <div className="py-4 space-y-4">
          <div className="bg-base-200 p-4 rounded-lg">
            <div className="text-sm opacity-70 mb-1">Amount to burn</div>
            <div className="text-2xl font-bold">{toToken(amount, 8)} MNEE</div>
          </div>

          <div className="alert alert-warning">
            <div className="flex flex-col items-start gap-1">
              <div className="font-semibold">Warning</div>
              <p className="text-sm">
                This action will permanently remove these tokens from the total supply. 
                This operation cannot be undone once approved.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-action">
          <button 
            type="button" 
            className="btn" 
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-error"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Creating Request...
              </>
            ) : (
              'Request Burn'
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 