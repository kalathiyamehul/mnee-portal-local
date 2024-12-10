import { FaPause, FaPlay } from 'react-icons/fa6';
import type { Activity } from './types';

interface SystemStatusProps {
  isPaused: boolean;
  handlePauseToggle: () => void;
  pendingPauseRequest: Activity | undefined;
}

export const SystemStatus = ({ 
  isPaused, 
  handlePauseToggle, 
  pendingPauseRequest 
}: SystemStatusProps) => (
  <div className="mb-6">
    <h2 className="text-xl sm:text-2xl font-bold mb-2">System Status</h2>
    <div className="flex flex-wrap items-center gap-2">
      <div className={`badge badge-lg ${isPaused ? 'badge-warning' : 'badge-success'}`}>
        {isPaused ? <FaPause className="mr-1" /> : <FaPlay className="mr-1" />}
        <span className="text-sm">{isPaused ? 'Paused' : 'Active'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs sm:text-sm">Toggle:</span>
        <input
          type="checkbox"
          className="toggle toggle-sm sm:toggle-md"
          checked={isPaused}
          onChange={handlePauseToggle}
          disabled={!!pendingPauseRequest}
        />
      </div>
      {pendingPauseRequest && (
        <span className="text-warning text-xs sm:text-sm">Pending approval</span>
      )}
    </div>
  </div>
); 