import type { FC } from 'react';
import { FaSpinner } from 'react-icons/fa6';

interface MintModalProps {
  mintAddress: string;
  setMintAddress: (value: string) => void;
  mintAmount: string;
  setMintAmount: (value: string) => void;
  mintLoading: boolean;
  handleMintRequest: (e: React.FormEvent) => void;
}

export const MintModal: FC<MintModalProps> = ({
  mintAddress,
  setMintAddress,
  mintAmount,
  setMintAmount,
  mintLoading,
  handleMintRequest,
}) => (
  <dialog id="mint_modal" className="modal">
    <div className="modal-box">
      <h3 className="font-bold text-lg mb-4">Create Mint Request</h3>
      <form onSubmit={handleMintRequest}>
        <div className="form-control">
          <label className="label" htmlFor="mintAddress">
            <span className="label-text">Receiver Address</span>
          </label>
          <input
            type="text"
            id="mintAddress"
            className="input input-bordered w-full mb-4"
            value={mintAddress}
            onChange={(e) => setMintAddress(e.target.value)}
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
            value={mintAmount}
            onChange={(e) => setMintAmount(e.target.value)}
            placeholder="Enter amount to mint"
            min="1"
            required
          />
        </div>
        <div className="modal-action">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const modal = document.getElementById('mint_modal') as HTMLDialogElement;
                modal.close();
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={mintLoading || !mintAddress || !mintAmount}
          >
            {mintLoading ? <FaSpinner className="animate-spin" /> : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  </dialog>
); 