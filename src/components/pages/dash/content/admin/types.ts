import type { MNEEUtxo } from '@/types';
import type { Config } from '@prisma/client';
import type { IconType } from 'react-icons';

export interface BurnUtxo extends MNEEUtxo {
  burnRequest?: BurnRequest;
}


export interface Fee {
	min: number;
	max: number;
	fee: number;
	[key: string]: number;
}

// export type ConfigWithFees = Omit<Config, 'fees'> & {
// 	fees: Fee[];
// }

export interface BaseRequest {
	id: string;
	status: 'PENDING' | 'APPROVED' | 'CANCELLED' | 'REFUNDED' | 'DONE';
	createdAt: string;
	requester: {
		email: string;
		name: string | null;
	};
	approvals: Array<{
		id: string;
		approver: {
			email: string;
			name: string | null;
		};
	}>;
}

export interface FreezeRequest extends BaseRequest {
	action: 'FREEZE' | 'UNFREEZE';
	address: string;
}

export interface BlacklistRequest extends BaseRequest {
	action: 'BLACKLIST' | 'UNBLACKLIST';
	address: string;
}

export interface SystemRequest extends BaseRequest {
	action: 'PAUSE' | 'RESUME';
}

export interface MintRequest extends BaseRequest {
	action: 'MINT';
	address: string;
	amount: string;
	customer?: {
		id: string;
		name: string;
		email: string;
		address: string;
	} | null;
}

export interface BurnRequest {
	id: string;
	amount: string;
	status: 'PENDING' | 'APPROVED' | 'CANCELLED' | 'REFUNDED';
	requester: {
		email: string;
		name: string | null;
	};
	createdAt: string;
	updatedAt: string;
	outpoint: string;
	approvals: Array<{
		id: string;
		approver: {
			email: string;
			name: string | null;
		};
	}>;
	requiresApproval?: boolean;
}

export type ActivityStatus = 
  | "PENDING"
  | "APPROVED"
  | "CANCELLED"
  | "DONE"
  | "REFUNDED"
  | "REJECTED";

export interface Activity {
  id: string;
  type: "MINT" | "BURN" | "FREEZE" | "BLACKLIST" | "ACTION";
  action?: 'FREEZE' | 'UNFREEZE' | 'BLACKLIST' | 'UNBLACKLIST' | 'PAUSE' | 'RESUME' | 'MINT' | 'BURN';
  status: ActivityStatus;
  createdAt: string;
  updatedAt: string;
  amount?: string;
  address?: string;
  txid?: string;
  outpoint?: string;
  requester: {
    name: string | null;
    email: string;
  };
  requestedBy: string;
  approvedBy?: string;
  approver?: {
    name: string | null;
    email: string;
  };
  approvals: Array<{
    id: string;
    approver: {
      email: string;
      name: string | null;
    };
  }>;
  customer?: {
    id: string;
    name: string;
    email: string;
    address: string;
  } | null;
  requiresApproval?: boolean;
}

export interface AddressStatus {
	address: string;
	isBlacklisted: boolean;
	isFrozen: boolean;
	hasPendingFreeze: boolean;
	hasPendingBlacklist: boolean;
	pendingFreezeAction?: 'FREEZE' | 'UNFREEZE';
	pendingBlacklistAction?: 'BLACKLIST' | 'UNBLACKLIST';
	requester?: {
		email: string;
		name: string | null;
	};
	lastUpdate: string;
}

export interface StatusResponse {
	isPaused: boolean;
	freezeRequests: FreezeRequest[];
	blacklists: BlacklistRequest[];
	systemRequests: SystemRequest[];
	mintRequests: MintRequest[];
	burnRequests: BurnRequest[];
	error?: string;
}

export interface ActivityListProps {
	showOnlyPending: boolean;
	setShowOnlyPending: (value: boolean) => void;
	filteredActivities: Activity[];
	config: Config;
	loading: boolean;
	canCancel: (activity: Activity) => boolean;
	canApprove: (activity: Activity) => boolean;
	handleCancel: (id: string, type: Activity['type']) => Promise<void>;
	handleApprove: (id: string, type: Activity['type']) => Promise<void>;
	getActivityIcon: (activity: Activity) => IconType;
	getActivityDisplayText: (activity: Activity) => string;
	requiresApproval: (activity: Activity) => boolean;
	getApprovalCount: (activity: Activity) => number;
	showPendingSwitch?: boolean;
	showRequester?: boolean;
}

export interface SystemStatusProps {
	isPaused: boolean;
	onPauseToggle: () => Promise<void>;
}

export interface ActiveRestrictionsProps {
	restrictions: AddressStatus[];
} 