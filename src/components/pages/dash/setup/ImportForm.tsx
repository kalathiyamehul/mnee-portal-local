import { SetupCard } from './SetupCard';

interface ImportFormProps {
  onBack: () => void;
  tokenId: string;
  decimals: number | null;
  feeAddress: string;
  loading: boolean;
  onTokenIdChange: (value: string) => void;
  onFeeAddressChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export function ImportForm({
  onBack,
  tokenId,
  decimals,
  feeAddress,
  loading,
  onTokenIdChange,
  onFeeAddressChange,
  onSubmit,
}: ImportFormProps) {
  return (
    <SetupCard title="Import Token">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="form-control">
          <label htmlFor="tokenId" className="label">
            <span className="label-text">Token ID</span>
          </label>
          <input
            id="tokenId"
            type="text"
            className="input input-bordered max-w-md w-full"
            value={tokenId}
            onChange={(e) => onTokenIdChange(e.target.value)}
            required
          />
        </div>

        <div className="form-control">
          <label htmlFor="feeAddress" className="label">
            <span className="label-text">Fee Address</span>
          </label>
          <input
            id="feeAddress"
            type="text"
            className="input input-bordered max-w-md w-full"
            value={feeAddress}
            onChange={(e) => onFeeAddressChange(e.target.value)}
            required
          />
        </div>

        {decimals !== null && (
          <div className="alert alert-info">
            <span>Token decimals: {decimals}</span>
          </div>
        )}

        <div className="form-control mt-4">
          <button
            type="submit"
            className={`btn btn-primary ${loading ? 'loading' : ''}`}
            disabled={loading || decimals === null}
          >
            {decimals === null ? 'Import Token' : 'Complete Setup'}
          </button>
          <button
            type="button"
            className="btn btn-ghost mt-2"
            onClick={onBack}
          >
            Back
          </button>
        </div>
      </form>
    </SetupCard>
  );
} 