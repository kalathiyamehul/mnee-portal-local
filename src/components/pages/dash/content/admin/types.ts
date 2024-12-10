import { config } from '@prisma/client';
import type { Session } from 'next-auth';

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

export interface BlacklistRequest extends BaseRequest {
	action: 'BLACKLIST' | 'UNBLACKLIST';
	address: string;
}

export interface SystemRequest extends BaseRequest {
	action: 'PAUSE' | 'RESUME';
}

export interface MintRequest extends BaseRequest {
	amount: number;
	address: string;
}

export interface BurnRequest extends BaseRequest {
	amount: number;
}

export type Activity = (
	| (FreezeRequest & { type: 'FREEZE' })
	| (BlacklistRequest & { type: 'BLACKLIST' })
	| (SystemRequest & { type: 'ACTION' })
	| (MintRequest & { type: 'MINT'; action: 'MINT' })
	| (BurnRequest & { type: 'BURN'; action: 'BURN' })
);

export interface AddressStatus {
	address: string;
	isBlacklisted: boolean;
	isFrozen: boolean;
}

export interface ActivityCardProps {
	activity: Activity;
	config: config | null;
	session: Session | null;
	loading: boolean;
	canCancel: (activity: Activity) => boolean;
	canApprove: (activity: Activity) => boolean;
	handleCancel: (id: string, type: Activity['type']) => void;
	handleApprove: (id: string, type: Activity['type']) => void;
	getActivityIcon: (activity: Activity) => JSX.Element | null;
	getActivityDisplayText: (activity: Activity) => string;
	requiresApproval: (activity: Activity) => boolean;
	getApprovalCount: (activity: Activity) => number;
}

export interface ActivityListProps {
	showOnlyPending: boolean;
	setShowOnlyPending: (value: boolean) => void;
	filteredActivities: Activity[];
	config: config | null;
	session: Session | null;
	loading: boolean;
	canCancel: (activity: Activity) => boolean;
	canApprove: (activity: Activity) => boolean;
	handleCancel: (id: string, type: Activity['type']) => void;
	handleApprove: (id: string, type: Activity['type']) => void;
	getActivityIcon: (activity: Activity) => JSX.Element | null;
	getActivityDisplayText: (activity: Activity) => string;
	requiresApproval: (activity: Activity) => boolean;
	getApprovalCount: (activity: Activity) => number;
} 