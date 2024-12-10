import { useState } from 'react';
import { FaSpinner } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';

interface MintModalProps {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const MintModal = ({
  onClose,
  onSuccess
}: MintModalProps) => {
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !amount) return;

    try {
      setLoading(true);
      const response = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          address,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create mint request');
      }

      await onSuccess();
      onClose();
      toast.success('Mint request created');
    } catch (error) {
      console.error('Error creating mint request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create mint request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog id="mint_modal" className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">Create Mint Request</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-control">
            <label className="label" htmlFor="mintAddress">
              <span className="label-text">Receiver Address</span>
            </label>
            <input
              type="text"
              id="mintAddress"
              className="input input-bordered w-full mb-4"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Bitcoin SV Address"
              required
            />
            <label className="label" htmlFor="mintAmount">
              <span className="label-text">Amount</span>
            </label>
            <input
              type="number"
              id="mintAmount"
              className="input input-bordered w-full"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to mint"
              min="1"
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
              type="submit"
              className="btn btn-primary"
              disabled={loading || !address || !amount}
            >
              {loading ? <FaSpinner className="animate-spin" /> : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}; 