interface SystemStatusProps {
  isPaused: boolean;
  onPauseToggle: () => Promise<void>;
}

export const SystemStatus = ({ isPaused, onPauseToggle }: SystemStatusProps) => {
  return (
    <div className="bg-base-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-error' : 'bg-success'}`} />
          <span className="font-medium">
            System is {isPaused ? 'Paused' : 'Active'}
          </span>
        </div>
        <input
          type="checkbox"
          className="toggle toggle-success"
          checked={!isPaused}
          onChange={onPauseToggle}
        />
      </div>
    </div>
  );
}; 