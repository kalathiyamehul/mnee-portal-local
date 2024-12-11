import { FaSpinner, FaSnowflake, FaLock } from 'react-icons/fa6';

interface ActionModalsProps {
  freezeAddress: string;
  setFreezeAddress: (value: string) => void;
  freezeLoading: boolean;
  blacklistLoading: boolean;
  handleFreezeRequest: (e: React.FormEvent<HTMLFormElement | HTMLButtonElement>) => void;
  handleBlacklistRequest: (e: React.MouseEvent<HTMLButtonElement | HTMLFormElement>) => void;
  mintAddress: string;
  setMintAddress: (value: string) => void;
  mintAmount: string;
  setMintAmount: (value: string) => void;
  mintLoading: boolean;
  handleMintRequest: (e: React.FormEvent) => void;
  burnAmount: string;
  setBurnAmount: (value: string) => void;
  burnLoading: boolean;
  handleBurnRequest: (e: React.FormEvent) => void;
}

export const ActionModals = ({
  freezeAddress,
  setFreezeAddress,
  freezeLoading,
  blacklistLoading,
  handleFreezeRequest,
  handleBlacklistRequest,
  mintAddress,
  setMintAddress,
  mintAmount,
  setMintAmount,
  mintLoading,
  handleMintRequest,
  burnAmount,
  setBurnAmount,
  burnLoading,
  handleBurnRequest,
}: ActionModalsProps) => (
  <>
    {/* Freeze/Blacklist Modal */}
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

    {/* Mint Request Modal */}
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

    {/* Burn Modal */}
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
  </>
); 