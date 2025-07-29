import { apiFetch } from '@/utils/api';
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
  decimals: number;
}

export const BurnModal = ({ onClose, onSuccess, amount, utxo, decimals }: BurnModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [numApprovals, setNumApprovals] = useState(2); // Default value as per schema

  const handleBurn = async () => {
    setIsLoading(true);
    try {
      // console.log('Starting burn request with:', { amount, utxo });
      const outpoint = `${utxo.txid}_${utxo.vout}`;
      const payload = {
        amount,
        outpoint,
        no_of_approvals: numApprovals, // Pass to API
      };
      
      // console.log('Prepared burn payload:', payload);

      const response = await apiFetch('/api/burn', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      // console.log('Burn API response status:', response.status);
      const data = await response.json();
      // console.log('Burn API response data:', data);

      if (!response.ok) {
        // console.error('Burn request failed:', data);
        toast.error(data.error || 'Failed to create burn request');
        return;
      }

      toast.success('Burn request created successfully');
      onSuccess();
    } catch (error) {
      // console.error('Error in burn request process:', error);
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
            <div className="text-2xl font-bold">{toToken(amount, decimals)} MNEE</div>
            <div className="text-xs opacity-50 mt-1 break-all">
              UTXO: {utxo.txid}:{utxo.vout}
            </div>
            {/* New Field: Number of Approvals */}
            <div className="mt-4">
              <label className="text-sm opacity-70 mb-1 block" htmlFor="num-approvals">
                Number of Approvals
              </label>
              <input
                id="num-approvals"
                type="number"
                min={2}
                className="input input-bordered w-full"
                value={numApprovals}
                onChange={e => {
                  const val = Number(e.target.value);
                  if (val < 2) {
                    setNumApprovals(2);
                  } else {
                    setNumApprovals(val);
                  }
                }}
                disabled={isLoading}
              />
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
      <form method="dialog" className="modal-backdrop" onClick={onClose} onKeyUp={onClose}>
        <button type="button">close</button>
      </form>
    </dialog>
  );
};