import { useState } from 'react';
import { SetupCard } from './SetupCard';

interface DeployFormProps {
  onBack: () => void;
  onDeploy: (data: { 
    symbol: string; 
    amount: string; 
    decimals: number; 
    destinationAddress: string;
    feeAddress: string;
  }) => Promise<void>;
  loading: boolean;
}

export function DeployForm({ onBack, onDeploy, loading }: DeployFormProps) {
  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('');
  const [decimals, setDecimals] = useState<number>(8);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [feeAddress, setFeeAddress] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onDeploy({ symbol, amount, decimals, destinationAddress, feeAddress });
  };

  return (
    <SetupCard title="Deploy New Token">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="form-control">
          <label htmlFor="symbol" className="label">
            <span className="label-text">Token Symbol</span>
          </label>
          <input
            id="symbol"
            type="text"
            className="input input-bordered max-w-md w-full"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            required
          />
        </div>
        <div className="form-control">
          <label htmlFor="amount" className="label">
            <span className="label-text">Max Supply</span>
          </label>
          <input
            id="amount"
            type="number"
            className="input input-bordered max-w-md w-full"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="form-control">
          <label htmlFor="deployDecimals" className="label">
            <span className="label-text">Decimals</span>
          </label>
          <input
            id="deployDecimals"
            type="number"
            className="input input-bordered max-w-md w-full"
            value={decimals}
            onChange={(e) => setDecimals(Number(e.target.value))}
            min={0}
            max={12}
            required
          />
        </div>
        <div className="form-control">
          <label htmlFor="destinationAddress" className="label">
            <span className="label-text">Destination Address</span>
          </label>
          <input
            id="destinationAddress"
            type="text"
            className="input input-bordered max-w-md w-full"
            value={destinationAddress}
            onChange={(e) => setDestinationAddress(e.target.value)}
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
            onChange={(e) => setFeeAddress(e.target.value)}
            required
          />
        </div>
        <div className="form-control mt-4">
          <button
            type="submit"
            className={`btn btn-primary ${loading ? 'loading' : ''}`}
            disabled={loading}
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