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
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [blacklistLoading, setBlacklistLoading] = useState(false);

  const handleFreezeRequest = async () => {
    try {
      setFreezeLoading(true);
      const response = await fetch('/api/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          action: 'FREEZE',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create freeze request');
      }

      await onSuccess();
      onClose();
      toast.success('Freeze request created');
    } catch (error) {
      console.error('Error creating freeze request:', error);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          action: 'BLACKLIST',
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
      console.error('Error creating blacklist request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create blacklist request');
    } finally {
      setBlacklistLoading(false);
    }
  };

  return (
    <dialog id="freeze_modal" className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-2">Restrict Address</h3>
        <div className="mb-6 space-y-2 text-sm opacity-70">
          <p><FaSnowflake className="inline mr-2" /> Freeze: Prevents an address from sending funds</p>
          <p><FaLock className="inline mr-2" /> Blacklist: Prevents an address from receiving funds</p>
        </div>
        <div className="form-control">
          <label className="label" htmlFor="freezeAddress">
            <span className="label-text">Bitcoin Address</span>
          </label>
          <input
            type="text"
            id="freezeAddress"
            className="input input-bordered w-full"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter Bitcoin SV Address"
            required
          />
        </div>
        <div className="modal-action">
          <button
            type="button"
            className="btn"
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
            {blacklistLoading ? <FaSpinner className="animate-spin" /> : 'Blacklist'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleFreezeRequest}
            disabled={freezeLoading || !address}
          >
            {freezeLoading ? <FaSpinner className="animate-spin" /> : 'Freeze'}
          </button>
        </div>
      </div>
    </dialog>
  );
}; 