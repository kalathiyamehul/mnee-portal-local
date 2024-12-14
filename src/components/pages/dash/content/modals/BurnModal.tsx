import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { FaSpinner, FaFire } from 'react-icons/fa6';
import { toToken } from 'satoshi-token';

interface BurnModalProps {
  onClose: () => void;
  onSuccess: () => void;
  amount: number;
  utxo: {
    txid: string;
    vout: number;
  };
}

export function BurnModal({ onClose, onSuccess, amount, utxo }: BurnModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleBurn = async () => {
    setIsLoading(true);
    try {
      console.log('Sending burn request:', { amount, utxo });
      
      const response = await fetch('/api/burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount.toString(),
          txid: utxo.txid,
          vout: utxo.vout,
        }),
      });

      const data = await response.json();
      console.log('Burn response:', { status: response.status, data });

      if (!response.ok) {
        console.error('Burn failed:', data);
        toast.error(data.error || 'Failed to create burn request');
        return;
      }

      toast.success('Burn request created successfully');
      onSuccess();
    } catch (error) {
      console.error('Error creating burn request:', error);
      toast.error('Failed to create burn request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <dialog id="burn_modal" className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg flex items-center gap-2 text-error">
          <FaFire className="w-4 h-4" /> Confirm Token Burn
        </h3>
        
        <div className="py-4 space-y-4">
          <div className="bg-base-200 p-4 rounded-lg">
            <div className="text-sm opacity-70 mb-1">Amount to burn</div>
            <div className="text-2xl font-bold">{toToken(amount, 8)} MNEE</div>
            <div className="text-xs opacity-50 mt-1 break-all">
              UTXO: {utxo.txid}:{utxo.vout}
            </div>
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
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-error"
            onClick={handleBurn}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Processing...
              </>
            ) : (
              'Request Burn'
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button>close</button>
      </form>
    </dialog>
  );
} 