import { FaBan, FaCoins, FaFire, FaPause, FaPlay, FaSnowflake, FaArrowRotateLeft, FaUserPlus } from 'react-icons/fa6';
import type { Activity } from './types';
import type { IconType } from 'react-icons';

export const getActivityIcon = (activity: Activity): IconType => {
  switch (activity.type) {
    case 'FREEZE':
      return FaSnowflake;
    case 'BLACKLIST':
      return FaBan;
    case 'ACTION':
      return activity.action === 'PAUSE' ? FaPause : FaPlay;
    case 'CUSTOMER':
      return FaUserPlus;
    case 'MINT':
      return FaCoins;
    case 'BURN':
      return FaFire;
    case 'REFUND':
      return FaArrowRotateLeft;
    default:
      return FaSnowflake;
  }
};

export const wasAutoApproved = (activity: Activity): boolean => {
  // Blacklist actions are always auto-approved
  if (activity.type === 'BLACKLIST') {
    return true;
  }

  // For mint/burn/refund requests, check the requiresApproval flag
  if ((activity.type === 'MINT' || activity.type === 'BURN' || activity.type === 'REFUND') && 'requiresApproval' in activity) {
    return !activity.requiresApproval;
  }

  // All other actions require approval
  return false;
};

export const getActivityDisplayText = (activity: Activity): string => {
  switch (activity.type) {
    case 'BURN':
      return "Burn tokens";
    case 'MINT':
      if ('customer' in activity && activity.customer) {
        return `Mint to ${activity.customer.address}`;
      }
      return `Mint to ${activity.address}`;
    case 'CUSTOMER':
      return "New Customer";
    case 'FREEZE':
      return "Freeze address";
    case 'BLACKLIST':
      return `${activity.action === 'BLACKLIST' ? 'Blacklist' : 'Unblacklist'} address`;
    case 'ACTION':
      return activity.action as string;
    case 'REFUND':
      return "Refund tokens";
  }
}; 