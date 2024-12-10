import type { FC } from 'react';
import { FaSpinner, FaSnowflake, FaLock } from 'react-icons/fa6';

interface FreezeModalProps {
  freezeAddress: string;
  setFreezeAddress: (value: string) => void;
  freezeLoading: boolean;
  blacklistLoading: boolean;
  handleFreezeRequest: (e: React.FormEvent<HTMLFormElement | HTMLButtonElement>) => void;
  handleBlacklistRequest: (e: React.MouseEvent<HTMLButtonElement | HTMLFormElement>) => void;
}

export const FreezeModal: FC<FreezeModalProps> = ({
  freezeAddress,
  setFreezeAddress,
  freezeLoading,
  blacklistLoading,
  handleFreezeRequest,
  handleBlacklistRequest,
}) => (
  <dialog id="freeze_modal" className="modal">
    <div className="modal-box">
      <h3 className="font-bold text-lg mb-2">Restrict Address</h3>
      <div className="mb-6 space-y-2 text-sm opacity-70">
        <p><FaSnowflake className="inline mr-2" /> Freeze: Prevents an address from sending funds</p>
        <p><FaLock className="inline mr-2" /> Blacklist: Prevents an address from receiving funds</p>
      </div>
      <form onSubmit={() => {}}>
        <div className="form-control">
          <label className="label" htmlFor="freezeAddress">
            <span className="label-text">Bitcoin Address</span>
          </label>
          <input
            type="text"
            id="freezeAddress"
            className="input input-bordered w-full"
            value={freezeAddress}
            onChange={(e) => setFreezeAddress(e.target.value)}
            placeholder="Enter Bitcoin SV Address"
            required
          />
        </div>
        <div className="modal-action">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const modal = document.getElementById('freeze_modal') as HTMLDialogElement;
                modal.close();
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-error"
            onClick={handleBlacklistRequest}
            disabled={blacklistLoading || !freezeAddress}
          >
            {blacklistLoading ? <FaSpinner className="animate-spin" /> : 'Blacklist'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleFreezeRequest}
            disabled={freezeLoading || !freezeAddress}
          >
            {freezeLoading ? <FaSpinner className="animate-spin" /> : 'Freeze'}
          </button>
        </div>
      </form>
    </div>
  </dialog>
); 