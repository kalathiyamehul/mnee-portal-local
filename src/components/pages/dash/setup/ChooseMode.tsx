"use client";

import { SetupCard } from './SetupCard';
import { EnvWarning } from './EnvWarning';
import { useCallback, useState } from 'react';

type SetupMode = 'choose' | 'import' | 'deploy';

interface ChooseModeProps {
  onModeSelect: (mode: SetupMode) => void;
}

export function ChooseMode({ onModeSelect }: ChooseModeProps) {
  const [missing, setMissing] = useState<string[]>([]);

  const handleMissing = useCallback((missing: string[]) => {
    setMissing(missing);
  }, []);

  const isDisabled = missing.length > 0;

  return (
    <SetupCard title="Setup MNEE Dashboard">
      <EnvWarning onMissingVarsChange={handleMissing} />
      {missing.length > 0 && <div className="divider" />}
      <p className="mb-6">Choose how you want to set up your token:</p>
      <div className="flex flex-col gap-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onModeSelect('import')}
          disabled={isDisabled}
          title={isDisabled ? "Missing required environment variables" : undefined}
        >
          Import Existing Token
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onModeSelect('deploy')}
          disabled={isDisabled}
          title={isDisabled ? "Missing required environment variables" : undefined}
        >
          Deploy New Token
        </button>
      </div>
    </SetupCard>
  );
} 