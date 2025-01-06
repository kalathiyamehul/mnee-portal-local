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
  const [refundAddress, setRefundAddress] = useState('');

  const handleBurn = async () => {
    setIsLoading(true);
    try {
      console.log('Starting burn request with:', { amount, utxo, refundAddress });
      
      const outpoint = `${utxo.txid}_${utxo.vout}`;
      const payload = {
        amount,
        outpoint,
        refundAddress: refundAddress || undefined,
      };
      
      console.log('Prepared burn payload:', payload);

      const response = await fetch('/api/burn', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      console.log('Burn API response status:', response.status);
      const data = await response.json();
      console.log('Burn API response data:', data);

      if (!response.ok) {
        console.error('Burn request failed:', data);
        toast.error(data.error || 'Failed to create burn request');
        return;
      }

      toast.success('Burn request created successfully');
      onSuccess();
    } catch (error) {
      console.error('Error in burn request process:', error);
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
          </div>

          <div className="form-control w-full">
            <label htmlFor="refundAddress" className="label">
              <span className="label-text">Refund Address (Optional)</span>
              <span className="label-text-alt opacity-70">Where to send tokens if burn is cancelled</span>
            </label>
            <input
              id="refundAddress"
              type="text"
              className="input input-bordered w-full"
              value={refundAddress}
              onChange={(e) => setRefundAddress(e.target.value)}
              placeholder="Enter refund address"
            />
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