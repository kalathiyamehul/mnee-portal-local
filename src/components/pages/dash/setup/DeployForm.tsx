import { useState } from 'react';
import { SetupCard } from './SetupCard';
import { EnvWarning } from './EnvWarning';

interface DeployFormProps {
  onBack: () => void;
  onDeploy: (data: { feeAddress: string }) => Promise<void>;
  loading: boolean;
}

export function DeployForm({ onBack, onDeploy, loading }: DeployFormProps) {
  const [feeAddress, setFeeAddress] = useState('');
  const [missingVars, setMissingVars] = useState<string[]>([]);
  const disabled = missingVars.some(v => v === 'MINT_WIF' || v === 'BURN_WIF');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onDeploy({ feeAddress });
  };

  return (
    <SetupCard title="Deploy New Token">
      <EnvWarning onMissingVarsChange={setMissingVars} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="form-control">
          <label htmlFor="feeAddress" className="label">
            <span className="label-text">Fee Address</span>
          </label>
          <input
            id="feeAddress"
            type="text"
            className="input input-bordered max-w-md w-full"
            value={feeAddress}
            onChange={(e) => setFeeAddress(e.target.value)}
            required
            disabled={disabled}
          />
        </div>
        <div className="form-control mt-4">
          <button
            type="submit"
            className={`btn btn-primary ${loading ? 'loading' : ''}`}
            disabled={loading || disabled}
            title={disabled ? "Required environment variables are missing" : undefined}
          >
            Deploy Token
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