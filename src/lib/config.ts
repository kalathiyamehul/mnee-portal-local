// src/lib/config.ts
import { prisma } from "@/lib/prisma";

export const getConfig = async () => {
  const config = await prisma.config.findFirst();
  return config;
};