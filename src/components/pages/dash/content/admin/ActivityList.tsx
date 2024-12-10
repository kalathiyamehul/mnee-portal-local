import { FaSnowflake, FaCoins, FaFire } from 'react-icons/fa6';
import { ActivityCard } from './ActivityCard';
import type { ActivityListProps } from './types';

export const ActivityList = ({
  showOnlyPending,
  setShowOnlyPending,
  filteredActivities,
  ...props
}: ActivityListProps) => (
  <div>
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl sm:text-2xl font-bold">Activity</h2>
        <label className="label cursor-pointer gap-2 px-2">
          <span className="label-text text-sm">Pending Only</span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm sm:toggle-md"
            checked={showOnlyPending}
            onChange={(e) => setShowOnlyPending(e.target.checked)}
          />
        </label>
      </div>
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            const modal = document.getElementById('freeze_modal') as HTMLDialogElement;
            modal.showModal();
          }}
        >
          <FaSnowflake className="mr-1" /> 
          <span className="text-sm">Restrict</span>
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            const modal = document.getElementById('mint_modal') as HTMLDialogElement;
            modal.showModal();
          }}
        >
          <FaCoins className="mr-1" /> 
          <span className="text-sm">Mint</span>
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            const modal = document.getElementById('burn_modal') as HTMLDialogElement;
            modal.showModal();
          }}
        >
          <FaFire className="mr-2" /> Burn
        </button>
      </div>
    </div>
    <div className="space-y-3">
      {filteredActivities?.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          {...props}
        />
      ))}
    </div>
  </div>
); 