import { SetupCard } from './SetupCard';

type SetupMode = 'choose' | 'import' | 'deploy';

export function ChooseMode({ onModeSelect }: { onModeSelect: (mode: SetupMode) => void }) {
  return (
    <SetupCard title="Setup MNEE Dashboard">
      <p className="mb-6">Choose how you want to set up your token:</p>
      <div className="flex flex-col gap-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onModeSelect('import')}
        >
          Import Existing Token
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onModeSelect('deploy')}
        >
          Deploy New Token
        </button>
      </div>
    </SetupCard>
  );
} 