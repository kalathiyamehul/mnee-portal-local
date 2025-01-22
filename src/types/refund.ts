import type { ActionStatus, User } from "@prisma/client";

export interface RefundRequest {
  id: string;
  outpoint: string;
  refundAddress: string;
  amount: bigint;
  status: ActionStatus;
  requestedBy: string;
  txid: string;
  requiresApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
  requester: Pick<User, "id" | "email" | "name">;
  approvals: RefundApproval[];
}

export interface RefundApproval {
  id: string;
  refundRequestId: string;
  approvedBy: string;
  createdAt: Date;
  approver: Pick<User, "id" | "email" | "name">;
} 