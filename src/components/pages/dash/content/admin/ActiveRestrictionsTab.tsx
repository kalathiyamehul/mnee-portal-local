import { ActiveRestrictions } from './ActiveRestrictions';
import type { AddressStatus } from './types';
import type { MouseEvent } from 'react';

interface ActiveRestrictionsTabProps {
  restrictions: AddressStatus[];
  loading: boolean;
  handleUnblacklist: (e: MouseEvent<HTMLButtonElement>, address: string) => Promise<void>;
  handleFreezeRequest: (e: MouseEvent<HTMLButtonElement>, address: string) => Promise<void>;
  handleUnfreeze: (address: string) => Promise<void>;
}

export const ActiveRestrictionsTab = ({
  restrictions,
  loading,
  handleUnblacklist,
  handleFreezeRequest,
  handleUnfreeze,
}: ActiveRestrictionsTabProps) => {
  return (
    <div className="p-4">
      <h2 className="text-xl sm:text-2xl font-bold mb-4">Active Restrictions</h2>
      <ActiveRestrictions 
        restrictions={restrictions}
        loading={loading}
        handleUnblacklist={handleUnblacklist}
        handleFreezeRequest={handleFreezeRequest}
        handleUnfreeze={handleUnfreeze}
      />
    </div>
  );
}; 