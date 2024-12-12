import { FaBan, FaCoins, FaFire, FaPause, FaPlay, FaSnowflake } from 'react-icons/fa6';
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
    case 'MINT':
      return FaCoins;
    case 'BURN':
      return FaFire;
    default:
      return FaSnowflake;
  }
};

export const getActivityDisplayText = (activity: Activity): string => {
  switch (activity.type) {
    case 'BURN':
      return `Burn tokens`;
    case 'MINT':
      if ('customer' in activity && activity.customer) {
        return `Mint to ${activity.customer.name}`;
      }
      return `Mint to ${activity.address}`;
    case 'FREEZE':
      return `${activity.action} ${activity.address}`;
    case 'BLACKLIST':
      return `${activity.action} ${activity.address}`;
    case 'ACTION':
      return activity.action;
  }
}; 