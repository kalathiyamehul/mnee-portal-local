"use server"

// src/lib/config.ts
import type { Config } from '@prisma/client';
import { cache } from 'react';
import { prisma } from './prisma';

// In-memory cache with expiration
let configCache: {
  data: Config | null;
  timestamp: number;
  requestCount: number;
} = {
  data: null,
  timestamp: 0,
  requestCount: 0,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

// Use React's cache function to dedupe requests within a render cycle
export const getConfig = cache(async (forceFresh = false): Promise<Config | null> => {
  const now = Date.now();
  configCache.requestCount++;

  // Check in-memory cache first
  if (!forceFresh && configCache.data && (now - configCache.timestamp) < CACHE_TTL) {
    // console.log(
    //   'Config: Cache hit #%d, age: %ds, caller: %s', 
    //   configCache.requestCount,
    //   Math.round((now - configCache.timestamp) / 1000),
    //   new Error().stack?.split('\n')[2]?.trim() || 'unknown'
    // );
    return configCache.data;
  }

  // Log cache miss or force refresh
  // console.log(
  //   'Config: %s, caller: %s',
  //   forceFresh ? 'Force refresh' : 'Cache miss',
  //   new Error().stack?.split('\n')[2]?.trim() || 'unknown'
  // );

  // Fetch fresh data
  const config = await prisma.config.findFirst({
    where: { id: 1 },
  });

  // Update in-memory cache
  configCache = {
    data: config,
    timestamp: now,
    requestCount: configCache.requestCount,
  };

  return config;
});

// Function to invalidate the cache when config is updated
export async function invalidateConfigCache() {
  'use server';
  // console.log('Config: Cache invalidated by:', new Error().stack?.split('\n')[2]?.trim() || 'unknown');
  // configCache = {
  //   data: null,
  //   timestamp: 0,
  //   requestCount: 0,
  // };
}

// Revalidate config in all active sessions
export async function revalidateConfig() {
  'use server';
  await invalidateConfigCache();
  // Force fresh data
  await getConfig(true);
}