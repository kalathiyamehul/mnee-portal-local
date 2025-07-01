import { PrismaClient, Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from './authOptions';

export enum ActivityAction {
  // Mint Actions
  MINT_REQUEST_CREATE = 'MINT_REQUEST_CREATE',
  MINT_REQUEST_CANCEL = 'MINT_REQUEST_CANCEL',
  MINT_REQUEST_APPROVE = 'MINT_REQUEST_APPROVE',
  MINT_REQUEST_REJECT = 'MINT_REQUEST_REJECT',
  MINT_REQUEST_FULLY_APPROVED = 'MINT_REQUEST_FULLY_APPROVED',
  MINT_TX_COMPLETED = 'MINT_TX_COMPLETED',

  // Burn Actions
  BURN_REQUEST_CREATE = 'BURN_REQUEST_CREATE',
  BURN_REQUEST_CANCEL = 'BURN_REQUEST_CANCEL',
  BURN_REQUEST_APPROVE = 'BURN_REQUEST_APPROVE',
  BURN_REQUEST_REJECT = 'BURN_REQUEST_REJECT',
  BURN_REQUEST_SETTLE = 'BURN_REQUEST_SETTLE',
  BURN_REQUEST_FULLY_APPROVED = 'BURN_REQUEST_FULLY_APPROVED',
  
  // Refund Actions
  REFUND_REQUEST_CREATE = 'REFUND_REQUEST_CREATE',
  REFUND_REQUEST_CANCEL = 'REFUND_REQUEST_CANCEL',
  REFUND_REQUEST_APPROVE = 'REFUND_REQUEST_APPROVE',
  REFUND_REQUEST_FULLY_APPROVED = 'REFUND_REQUEST_FULLY_APPROVED',
  REFUND_TX_COMPLETED = 'REFUND_TX_COMPLETED',
  BURN_REQUEST_REFUNDED = 'BURN_REQUEST_REFUNDED',

  // Customer Actions
  CUSTOMER_REQUEST_CREATE = 'CUSTOMER_REQUEST_CREATE',
  CUSTOMER_REQUEST_CANCEL = 'CUSTOMER_REQUEST_CANCEL',
  CUSTOMER_REQUEST_APPROVE = 'CUSTOMER_REQUEST_APPROVE',
  CUSTOMER_REQUEST_FULLY_APPROVED = 'CUSTOMER_REQUEST_FULLY_APPROVED',
  NEW_CUSTOMER_CREATED = 'NEW_CUSTOMER_CREATED',
  CUSTOMER_UPDATE = 'CUSTOMER_UPDATE',

  // Freeze Actions
  FREEZE_REQUEST_CREATE = 'FREEZE_REQUEST_CREATE',
  FREEZE_REQUEST_CANCEL = 'FREEZE_REQUEST_CANCEL',
  FREEZE_REQUEST_APPROVE = 'FREEZE_REQUEST_APPROVE',
  FREEZE_REQUEST_FULLY_APPROVED = 'FREEZE_REQUEST_FULLY_APPROVED',

  // Blacklist Actions
  BLACKLIST_REQUEST_CREATE = 'BLACKLIST_REQUEST_CREATE',
  BLACKLIST_REQUEST_CANCEL = 'BLACKLIST_REQUEST_CANCEL',
  BLACKLIST_REQUEST_APPROVE = 'BLACKLIST_REQUEST_APPROVE',
  BLACKLIST_REQUEST_FULLY_APPROVED = 'BLACKLIST_REQUEST_FULLY_APPROVED',

  // System Action Request
  SYSTEM_PAUSE_REQUEST = 'SYSTEM_PAUSE_REQUEST',
  SYSTEM_PAUSE_REQUEST_APPROVE = 'SYSTEM_PAUSE_REQUEST_APPROVE',
  SYSTEM_PAUSE_REQUEST_FULLY_APPROVED = 'SYSTEM_PAUSE_REQUEST_FULLY_APPROVED',
  SYSTEM_RESUME_REQUEST = 'SYSTEM_RESUME_REQUEST',
  SYSTEM_RESUME_REQUEST_APPROVE = 'SYSTEM_RESUME_REQUEST_APPROVE',
  SYSTEM_RESUME_REQUEST_FULLY_APPROVED = 'SYSTEM_RESUME_REQUEST_FULLY_APPROVED',
  SYSTEM_PAUSE_REQUEST_CANCEL = 'SYSTEM_PAUSE_REQUEST_CANCEL',
  SYSTEM_RESUME_REQUEST_CANCEL = 'SYSTEM_RESUME_REQUEST_CANCEL',

  // Config Actions
  CONFIG_UPDATED = 'CONFIG_UPDATED',
  CONFIG_UPSERT = 'CONFIG_UPSERT',
  TOKEN_DEPLOYED = 'TOKEN_DEPLOYED',
  TOKEN_DEPLOY_CONFIG_FAIL = 'TOKEN_DEPLOY_CONFIG_FAIL',

  // Role Actions
  ROLE_CREATED = 'ROLE_CREATED',
  ROLE_UPDATED = 'ROLE_UPDATED',
  ROLE_DELETED = 'ROLE_DELETED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REMOVED = 'ROLE_REMOVED',

  // Users Actions
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  
}

type ActivityDetails = {
  name: string;
  description: string;
  redirect_url?: string;
};

const getActivityDetails = (action: ActivityAction, metadata: any): ActivityDetails => {
  switch (action) {
    // Mint Actions
    case ActivityAction.MINT_REQUEST_CREATE:
      return {
        name: 'Mint Request Created',
        description: `Mint request created by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=mints'
      };
    case ActivityAction.MINT_REQUEST_CANCEL:
      return {
        name: 'Mint Request Cancelled',
        description: `Mint request ${metadata.mintRequestId} was cancelled by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=mints'
      }
    case ActivityAction.MINT_REQUEST_APPROVE:
      return {
        name: 'Mint Request Approval',
        description: `Mint request ${metadata.mintRequestId} was approved by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=mints'
      };
    case ActivityAction.MINT_REQUEST_REJECT:
      return {
        name: 'Mint Request Rejected',
        description: `Mint request ${metadata.mintRequestId} was rejected by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=mints'
      };
    case ActivityAction.MINT_REQUEST_FULLY_APPROVED:
      return {
        name: 'Mint Request Fully Approved',
        description: `Mint request ${metadata.mintRequestId} fully approved after reaching required approvals`,
        redirect_url: '/dash/admin?tab=mints'
      };
    case ActivityAction.MINT_TX_COMPLETED:
      return {
        name: 'Mint Transaction Completed',
        description: `Mint transaction ${metadata.txId} completed for Mint request ${metadata.mintRequestId}`,
        redirect_url: '/dash/admin?tab=mints'
      }

    // Burn Actions
    case ActivityAction.BURN_REQUEST_CREATE:
      return {
        name: 'Burn Request Created',
        description: `Burn request created by ${metadata.userEmail} for outpoint ${metadata.outpoint}`,
        redirect_url: '/dash/admin?tab=burns'
      };
    case ActivityAction.BURN_REQUEST_CANCEL:
      return {
        name: 'Burn Request Cancelled',
        description: `Burn request ${metadata.burnRequestId} was cancelled by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=burns'
      };
    case ActivityAction.BURN_REQUEST_APPROVE:
      return {
        name: 'Burn Request Approval',
        description: `Burn request ${metadata.burnRequestId} was approved by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=burns'
      };
    case ActivityAction.BURN_REQUEST_REJECT:
      return {
        name: 'Burn Request Rejected',
        description: `Burn request ${metadata.burnRequestId} was rejected by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=burns'
      };
    case ActivityAction.BURN_REQUEST_FULLY_APPROVED:
      return {
        name: 'Burn Request Fully Approved',
        description: `Burn request ${metadata.burnRequestId} fully approved after reaching required approvals`,
        redirect_url: '/dash/admin?tab=burns'
      };
    case ActivityAction.BURN_REQUEST_SETTLE:
      return {
        name: 'Burn Request Settled',
        description: `Burn request ${metadata.burnRequestId} was settled by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=burns'
      };

    // Refund Actions
    case ActivityAction.REFUND_REQUEST_CREATE:
      return {
        name: 'Refund Request Created',
        description: `Refund request created for outpoint ${metadata.outpoint} by user ${metadata.userEmail}. Refund address ${metadata.refundAddress} verified as original owner.`,
        redirect_url: '/dash/admin?tab=burns'
      };
    case ActivityAction.REFUND_REQUEST_CANCEL:
      return {
        name: 'Refund Request Cancelled',
        description: `Refund request ${metadata.refundRequestId} was cancelled by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=burns'
      }
    case ActivityAction.REFUND_REQUEST_APPROVE:
      return {
        name: 'Refund Request Approval',
        description: `Refund request ${metadata.refundRequestId} was approved by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=burns'
      };
    case ActivityAction.REFUND_REQUEST_FULLY_APPROVED:
      return {
        name: 'Refund Request Fully Approved',
        description: `Refund request ${metadata.refundRequestId} fully approved after reaching required approvals`,
        redirect_url: '/dash/admin?tab=burns'
      };
    case ActivityAction.REFUND_TX_COMPLETED:
      return {
        name: 'Refund Request Broadcasted',
        description: `Refund request ${metadata.refundRequestId} Broadcasted`,
      };
    case ActivityAction.BURN_REQUEST_REFUNDED:
      return {
        name: 'Burn Request Refunded',
        description: `Burn request ${metadata.burnRequestId} was refunded`,
        redirect_url: '/dash/admin?tab=burns'
      };

    // Customer Actions
    case ActivityAction.CUSTOMER_REQUEST_CREATE:
      return {
        name: 'Customer Request Created',
        description: `New Customer Request ${metadata.customerEmail} was Created by ${metadata.userEmail}`,
        redirect_url: '/dash/customers'
      };
    case ActivityAction.CUSTOMER_REQUEST_CANCEL:
      return {
        name: 'Customer Request Cancelled',
        description: `Customer request ${metadata.customerEmail} was cancelled by ${metadata.userEmail}`,
        redirect_url: '/dash/customers'
      };
    case ActivityAction.CUSTOMER_REQUEST_APPROVE:
      return {
        name: 'Customer Request Approval',
        description: `Customer request ${metadata.customerEmail} was approved by ${metadata.userEmail}`,
        redirect_url: '/dash/customers'
      };
    case ActivityAction.CUSTOMER_REQUEST_FULLY_APPROVED:
      return {
        name: 'Customer Request Fully Approved',
        description: `Customer request ${metadata.customerEmail} fully approved after reaching required approvals`,
        redirect_url: '/dash/customers'
      };
    case ActivityAction.NEW_CUSTOMER_CREATED:
      return {
        name: 'New Customer Created',
        description: `New Customer ${metadata.customerEmail} Created Successfully.`,
        redirect_url: '/dash/customers'
      };
    case ActivityAction.CUSTOMER_UPDATE:
      return {
        name: 'Customer Updated',
        description: `Customer ${metadata.customerId} Updated by ${metadata.userEmail}`,
        redirect_url: '/dash/customers'
      };

    // Freeze Actions
    case ActivityAction.FREEZE_REQUEST_CREATE:
      return {
        name: 'Freeze Request Created',
        description: `Freeze request was created by ${metadata.userEmail} for Address: ${metadata.address}`,
        redirect_url: '/dash/admin?tab=restrictions'
      };
    case ActivityAction.FREEZE_REQUEST_CANCEL:
      return {
        name: 'Freeze Request Cancelled',
        description: `Freeze request ${metadata.address} was cancelled by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=restrictions'
      };
    case ActivityAction.FREEZE_REQUEST_APPROVE:
      return {
        name: 'Freeze Request Approval',
        description: `Freeze request ${metadata.freezeRequestId} was approved by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=restrictions'
      };
    case ActivityAction.FREEZE_REQUEST_FULLY_APPROVED:
      return {
        name: 'Freeze Request Fully Approved',
        description: `Freeze request ${metadata.freezeRequestId} fully approved after reaching required approvals`,
        redirect_url: '/dash/admin?tab=restrictions'
      };

    // Blacklist Actions
    case ActivityAction.BLACKLIST_REQUEST_CREATE:
      return {
        name: 'Blacklist Request Created',
        description: `Blacklist request was created by ${metadata.userEmail} for Address: ${metadata.address}`,
        redirect_url: '/dash/admin?tab=restrictions'
      };
    case ActivityAction.BLACKLIST_REQUEST_CANCEL:
      return {
        name: 'Blacklist Request Cancelled',
        description: `Blacklist request for Address: ${metadata.address} was cancelled by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=restrictions'
      };
    case ActivityAction.BLACKLIST_REQUEST_APPROVE:
      return {
        name: 'Blacklist Request Approval',
        description: `Blacklist request for Address: ${metadata.address} was approved by ${metadata.userEmail}`,
        redirect_url: '/dash/admin?tab=restrictions'
      };
    case ActivityAction.BLACKLIST_REQUEST_FULLY_APPROVED:
      return {
        name: 'Blacklist Request Fully Approved',
        description: `Blacklist request for Address: ${metadata.address} fully approved after reaching required approvals`,
        redirect_url: '/dash/admin?tab=restrictions'
      };

    // System Action Request
    case ActivityAction.SYSTEM_PAUSE_REQUEST:
      return {
        name: 'System Pause Request',
        description: `System pause request was created by ${metadata.userEmail}`,
      };
    case ActivityAction.SYSTEM_RESUME_REQUEST:
      return {
        name: 'System Resume Request',
        description: `System resume request was created by ${metadata.userEmail}`,
      };
    case ActivityAction.SYSTEM_PAUSE_REQUEST_CANCEL:
      return {
        name: 'System Pause Request Cancelled',
        description: `System pause request ${metadata.actionRequestId} was cancelled by ${metadata.userEmail}`,
      };
    case ActivityAction.SYSTEM_RESUME_REQUEST_CANCEL:
      return {
        name: 'System Resume Request Cancelled',
        description: `System resume request ${metadata.actionRequestId} was cancelled by ${metadata.userEmail}`,
      };
    case ActivityAction.SYSTEM_PAUSE_REQUEST_APPROVE:
      return {
        name: 'System Pause Request Approved',
        description: `System pause request ${metadata.actionRequestId} was approved by ${metadata.userEmail}`,
      };
    case ActivityAction.SYSTEM_PAUSE_REQUEST_FULLY_APPROVED:
      return {
        name: 'System Pause Request Fully Approved',
        description: `System pause request ${metadata.actionRequestId} fully approved after reaching required approvals`,
      };
    case ActivityAction.SYSTEM_RESUME_REQUEST_APPROVE:
      return {
        name: 'System Resume Request Approved',
        description: `System resume request ${metadata.actionRequestId} was approved by ${metadata.userEmail}`,
      };
    case ActivityAction.SYSTEM_RESUME_REQUEST_FULLY_APPROVED:
      return {
        name: 'System Resume Request Fully Approved',
        description: `System resume request ${metadata.actionRequestId} fully approved after reaching required approvals`,
      };

    // Config Actions
    case ActivityAction.CONFIG_UPDATED:
      return {
        name: 'Config Updated',
        description: `Config was updated by ${metadata.userEmail}`,
      };
    case ActivityAction.CONFIG_UPSERT:
      return {
        name: 'Config Upserted',
        description: `Config has been Upserted by ${metadata.userEmail}`,
      };
    case ActivityAction.TOKEN_DEPLOYED:
      return {
        name: 'Token Deployed',
        description: `Token was deployed with tokenId ${metadata.tokenId} by ${metadata.userEmail}`,
      };
    case ActivityAction.TOKEN_DEPLOY_CONFIG_FAIL:
      return {
        name: 'Token Deploy Config Fail',
        description: `Token deployed with tokenId ${metadata.tokenId}, but config update failed`,
      }
    
    // Role Actions
    case ActivityAction.ROLE_CREATED:
      return {
        name: 'Role Created',
        description: `Role ${metadata.roleName} was created by ${metadata.userEmail}`,
      };
    case ActivityAction.ROLE_UPDATED:
      return {
        name: 'Role Updated',
        description: `Role ${metadata.roleName} was updated by ${metadata.userEmail}`,
      };
    case ActivityAction.ROLE_DELETED:
      return {
        name: 'Role Deleted',
        description: `Role ${metadata.roleName} was deleted by ${metadata.userEmail}`,
      };
    case ActivityAction.ROLE_ASSIGNED:
      return {
        name: 'Role Assigned',
        description: `Role ${metadata.roleName} was assigned to ${metadata.otherUserEmail} By ${metadata.userEmail}`,
      };
    case ActivityAction.ROLE_REMOVED:
      return {
        name: 'Role Removed',
        description: `Role ${metadata.roleId} was removed from ${metadata.otherUserEmail} By ${metadata.userEmail}`,
      };

    // Users Actions
    case ActivityAction.USER_CREATED:
      return {
        name: 'User Created',
        description: `User ${metadata.newUserEmail} was created by ${metadata.userEmail}`,
      };
    case ActivityAction.USER_UPDATED:
      return {
        name: 'User Updated',
        description: `User ${metadata.otherUserId} was updated by ${metadata.userEmail}`,
      };
    case ActivityAction.USER_DELETED:
      return {
        name: 'User Deleted',
        description: `User ${metadata.deletedUserEmail} was deleted by ${metadata.userEmail}`,
      };
    default:
      const exhaustiveCheck: never = action;
      throw new Error(`Unhandled action type: ${exhaustiveCheck}`);
  }
};

export async function logActivity(
  tx: Prisma.TransactionClient,
  {
    action,
    metadata,
  }: {
    action: ActivityAction;
    metadata: Record<string, any>;
  }
) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    throw new Error('No active session found for activity logging');
  }

  const { name, description, redirect_url } = getActivityDetails(action, {
    ...metadata,
    userId: session.user.id,
    userEmail: session.user.email
  });

  await tx.activityLog.create({
    data: {
      name,
      action,
      description,
      redirectUrl: redirect_url,
      metadata: {
        ...metadata,
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email
        },
      },
    },
  });
}