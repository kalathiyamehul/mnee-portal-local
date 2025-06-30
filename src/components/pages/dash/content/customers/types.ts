export type ActivityStatus = 
  | "PENDING"
  | "APPROVED"
  | "CANCELLED"
  | "DONE"
  | "REFUNDED"
  | "REJECTED"
  | "SETTLED";

export interface Activity {
  id: string;
  type: "CUSTOMER";
  action?: 'FREEZE' | 'UNFREEZE' | 'BLACKLIST' | 'UNBLACKLIST' | 'PAUSE' | 'RESUME' | 'MINT' | 'BURN' | 'REFUND' | 'CREATE';
  name?: string;
  email?: string;
  status: ActivityStatus;
  createdAt: string;
  updatedAt: string;
  amount?: string;
  reason?: string;
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
	no_of_approvals?: number;
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