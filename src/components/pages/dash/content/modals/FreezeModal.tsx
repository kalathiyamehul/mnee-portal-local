import { useState } from 'react';
import { FaSpinner, FaSnowflake, FaLock } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';

interface FreezeModalProps {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const FreezeModal = ({
  onClose,
  onSuccess
}: FreezeModalProps) => {
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('');  // Add reason state
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [no_of_approvals, setnoOfApprovals] = useState<number>(2);

  const handleFreezeRequest = async () => {
    try {
      setFreezeLoading(true);
      const response = await fetch('/api/freeze', {
        method: 'POST',
        body: JSON.stringify({
          address,
          action: 'FREEZE',
          no_of_approvals: no_of_approvals || 2,
          reason  // Include reason
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to create freeze request');
      }

      await onSuccess();
      onClose();
      toast.success('Freeze request created');
    } catch (error) {
      // console.error('Error creating freeze request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create freeze request');
    } finally {
      setFreezeLoading(false);
    }
  };

  const handleBlacklistRequest = async () => {
    try {
      setBlacklistLoading(true);
      const response = await fetch('/api/blacklist', {
        method: 'POST',
        body: JSON.stringify({
          address,
          action: 'BLACKLIST',
          no_of_approvals: no_of_approvals || 2,
          reason  // Include reason
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create blacklist request');
      }

      await onSuccess();
      onClose();
      toast.success('Blacklist request created');
    } catch (error) {
      // console.error('Error creating blacklist request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create blacklist request');
    } finally {
      setBlacklistLoading(false);
    }
  };

  return (
    <dialog id="freeze_modal" className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-bold mb-6">Restrict Address</h3>
        <div className="mb-6 space-y-2 text-sm opacity-70">
          <p><FaSnowflake className="inline mr-2" /> Freeze: Prevents an address from sending funds</p>
          <p><FaLock className="inline mr-2" /> Blacklist: Prevents an address from receiving funds</p>
        </div>
        <div className="space-y-4">
          <div className="form-control w-full block">
            <div className="label">
              <span className="label-text">Bitcoin Address</span>
            </div>
            <input
              type="text"
              className="input input-bordered w-full max-w-md font-mono"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Bitcoin SV Address"
              required
            />
          </div>
          <div className="form-control w-full block">
            <label className="label">
              <span className="label-text">Reason</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full max-w-md font-mono"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={100}
              placeholder="Reason for Freezing/Blacklisting Address"
              required
            />
          </div>
          <div className="form-control w-full block">
            <div className="label my-2">
              <span className="label-text">No of Approvals</span>
            </div>
            <input
              type="number"
              className="input input-bordered w-full max-w-md"
              value={isNaN(no_of_approvals) ? 2 : no_of_approvals}
              placeholder="Enter no_of_approvals value (integer)"
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setnoOfApprovals(isNaN(value) ? 2 : Math.max(2, Math.min(value, 1000)));
              }}
              min="2"
              max="1000"
              required
            />
            <div className="label my-2">
              <span className="label-text-alt text-sm text-base-content/70">
                Minimum 2 Approvals Required
              </span>
            </div>
          </div>
        </div>
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-error"
            onClick={handleBlacklistRequest}
            disabled={blacklistLoading || !address}
          >
            {blacklistLoading ? <FaSpinner className="animate-spin mr-2" /> : 'Blacklist'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleFreezeRequest}
            disabled={freezeLoading || !address}
          >
            {freezeLoading ? <FaSpinner className="animate-spin mr-2" /> : 'Freeze'}
          </button>
        </div>
      </div>
    </dialog>
  );
};