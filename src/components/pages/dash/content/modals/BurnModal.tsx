import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { FaSpinner } from 'react-icons/fa6';

interface BurnModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function BurnModal({ onClose, onSuccess }: BurnModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    try {
      setLoading(true);
      const response = await fetch('/api/burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
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
        <h3 className="font-bold text-lg mb-4">Burn Tokens</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Amount</span>
            </label>
            <input
              type="number"
              className="input input-bordered"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <FaSpinner className="animate-spin" /> : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 