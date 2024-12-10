import type { FC } from 'react';

interface BurnModalProps {
  burnAmount: string;
  setBurnAmount: (value: string) => void;
  burnLoading: boolean;
  handleBurnRequest: (e: React.FormEvent) => void;
}

export const BurnModal: FC<BurnModalProps> = ({
  burnAmount,
  setBurnAmount,
  burnLoading,
  handleBurnRequest,
}) => (
  <dialog id="burn_modal" className="modal">
    <div className="modal-box">
      <h3 className="font-bold text-lg mb-4">Burn Tokens</h3>
      <form onSubmit={handleBurnRequest}>
        <div className="form-control">
          <label className="label">
            <span className="label-text">Amount</span>
          </label>
          <input
            type="number"
            className="input input-bordered"
            value={burnAmount}
            onChange={(e) => setBurnAmount(e.target.value)}
            required
          />
        </div>
        <div className="modal-action">
          <button type="button" className="btn" onClick={() => {
            const modal = document.getElementById('burn_modal') as HTMLDialogElement;
              modal.close();
          }}>
            Cancel
          </button>
          <button type="submit" className={`btn btn-primary ${burnLoading ? 'loading' : ''}`}>
            {burnLoading ? 'Creating...' : 'Create Burn Request'}
          </button>
        </div>
      </form>
    </div>
  </dialog>
); 