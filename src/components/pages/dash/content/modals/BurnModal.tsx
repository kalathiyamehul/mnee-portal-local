import { apiFetch } from '@/utils/api';
import { useState, useEffect } from 'react';
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
  const [numApprovals, setNumApprovals] = useState("");
  const [errors, setErrors] = useState({
    numApprovalsError: "",
  });
  const [config, setConfig] = useState<{
    minNoOfApproval: number;
    maxNoOfApproval: number;
  } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await apiFetch("/api/config");
        if (!response.ok) {
          throw new Error("Failed to fetch configuration");
        }
        const data = await response.json();
        setConfig({
          minNoOfApproval: data.minNoOfApproval,
          maxNoOfApproval: data.maxNoOfApproval,
        });
        setNumApprovals(`${data.minNoOfApproval}`);
      } catch (error) {
        toast.error("Failed to fetch configuration");
      }
    };

    fetchConfig();
  }, []);

  const validateApproval = (value: number) => {
    if (config?.minNoOfApproval && value < config.minNoOfApproval)
      return `Minimum ${config.minNoOfApproval} approval required`;
    if (config?.maxNoOfApproval && value > config.maxNoOfApproval)
      return `Maximum ${config.maxNoOfApproval} approvals allowed`;
    return "";
  };

  const handleBurn = async () => {
    const numApprovalsError = validateApproval(Number(numApprovals));
    setErrors({
      numApprovalsError: numApprovalsError,
    });
    if (numApprovalsError) {
      toast.error(numApprovalsError || "Please fix the form errors");
      return;
    }
    setIsLoading(true);
    try {
      // console.log('Starting burn request with:', { amount, utxo });
      const outpoint = `${utxo.txid}_${utxo.vout}`;
      const payload = {
        amount,
        outpoint,
        no_of_approvals: Number(numApprovals), // Pass to API
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
                className="input input-bordered w-full"
                value={numApprovals}
                onChange={(e) => {
                  let value = e.target.value;
                  // Only allow non-negative integers
                  if (/^\d*$/.test(value)) {
                    let num = parseInt(value, 10);
                    if (
                      isNaN(num) ||
                      (config && num < config.minNoOfApproval)
                    ) {
                      setNumApprovals(
                        config?.minNoOfApproval?.toString() || ""
                      );
                    } else if (
                      config?.maxNoOfApproval &&
                      num > config.maxNoOfApproval
                    ) {
                      toast.error(
                        `No of Approvals must be less than or equal to ${config?.maxNoOfApproval}`
                      );
                    } else {
                      setNumApprovals(value);
                    }
                  }
                }}
                disabled={isLoading}
              />
              {errors && (
                <div className="label mt-1">
                  <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">
                    {errors.numApprovalsError}
                  </span>
                </div>
              )}
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