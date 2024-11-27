// src/lib/config.ts
import { prisma } from "@/lib/prisma";

export async function getConfig() {
  const config = await prisma.config.findFirst();
  return config;
}