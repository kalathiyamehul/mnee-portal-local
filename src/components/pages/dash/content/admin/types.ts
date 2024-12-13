import { Config } from '@prisma/client';
import type { Session } from 'next-auth';
import type { IconType } from 'react-icons';

export interface Fee {
	min: number;
	max: number;
	fee: number;
	[key: string]: number;
}

export type ConfigWithFees = Omit<Config, 'fees'> & {
	fees: Fee[];
}

export interface Approval {
	id: string;
	approver: {
		name: string | null;
			email: string;
	};
}

export type ActionType = 'FREEZE' | 'UNFREEZE' | 'BLACKLIST' | 'UNBLACKLIST' | 'PAUSE' | 'RESUME' | 'MINT' | 'BURN';

export interface BaseRequest {
	id: string;
	status: 'PENDING' | 'APPROVED' | 'CANCELLED';
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

export interface BlacklistRequest {
	id: string;
	status: 'PENDING' | 'APPROVED' | 'CANCELLED';
	createdAt: string;
	requester: {
		email: string;
		name: string | null;
	};
	action: 'BLACKLIST' | 'UNBLACKLIST';
	address: string;
	type?: 'BLACKLIST';
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

export interface BurnRequest extends BaseRequest {
	action: 'BURN';
	amount: string;
}

export type Activity = (
	| (FreezeRequest & { type: 'FREEZE' })
	| (BlacklistRequest & { type: 'BLACKLIST' })
	| (SystemRequest & { type: 'ACTION' })
	| (MintRequest & { type: 'MINT' })
	| (BurnRequest & { type: 'BURN' })
);

export interface AddressStatus {
	address: string;
	isBlacklisted: boolean;
	isFrozen: boolean;
	hasPendingFreeze: boolean;
	pendingFreezeAction?: 'FREEZE' | 'UNFREEZE';
	requester: {
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
	config: ConfigWithFees | null;
	session: Session | null;
	loading: boolean;
	canCancel: (activity: Activity) => boolean;
	canApprove: (activity: Activity) => boolean;
	handleCancel: (id: string, type: Activity['type']) => Promise<void>;
	handleApprove: (id: string, type: Activity['type']) => Promise<void>;
	getActivityIcon: (activity: Activity) => IconType;
	getActivityDisplayText: (activity: Activity) => string;
	requiresApproval: (activity: Activity) => boolean;
	getApprovalCount: (activity: Activity) => number;
}

export interface ActivityTabProps {
	showOnlyPending: boolean;
	setShowOnlyPending: (value: boolean) => void;
	filteredActivities: Activity[];
	config: ConfigWithFees | null;
	loading: boolean;
	canCancel: (activity: Activity) => boolean;
	canApprove: (activity: Activity) => boolean;
	handleCancel: (id: string, type: Activity['type']) => Promise<void>;
	handleApprove: (id: string, type: Activity['type']) => Promise<void>;
	getActivityIcon: (activity: Activity) => IconType;
	getActivityDisplayText: (activity: Activity) => string;
	requiresApproval: (activity: Activity) => boolean;
	getApprovalCount: (activity: Activity) => number;
	showModal: (id: string) => void;
}

export interface SystemStatusProps {
	isPaused: boolean;
	onPauseToggle: () => Promise<void>;
}

export interface ActiveRestrictionsProps {
	restrictions: AddressStatus[];
} 