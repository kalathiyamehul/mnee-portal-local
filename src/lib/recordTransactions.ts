import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";

export enum TransactionType {
  MINT = "MINT",
  BURN = "BURN",
  REFUND = "REFUND",
}

export async function recordTransaction(
  tx: Prisma.TransactionClient,
  data: {
    requestId: string;
    type: TransactionType;
    requestedBy: string;
    txid: string;
    timestamp: Date;
    approvers: Record<string, any>;
  }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("No active session found for Recording Transaction");
  }

  await tx.transactionRecords.create({
    data: {
      requestId: data.requestId,
      type: data.type,
      requestedBy: data.requestedBy,
      txid: data.txid || "",
      timestamp: data.timestamp,
      approvers: {...data.approvers}
    },
  });
}
