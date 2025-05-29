import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBurnWif, getMintWif } from "@/env";
import { PrivateKey } from "@bsv/sdk";
import { getConfig, revalidateConfig } from "@/lib/config";
import { logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
import { hasServerPermission } from "@/lib/serverPermissions";
import { Resource, Action } from "@/lib/permission";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

// Enable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

export const GET = withCSRF(async function() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to access configuration." },
        { status: 401 }
      );
    }

    const config = await getConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No configuration found" },
        { status: 404 }
      );
    }
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching config:", error);
    return NextResponse.json(
      { error: "Error fetching configuration." },
      { status: 500 }
    );
  }
}, createAPIRateLimit())

export const POST = withCSRF(async function (request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to modify configuration." },
        { status: 401 }
      );
    }

    // Check permission to update config
    const canUpdateConfig = await hasServerPermission(Resource.CONFIG, Action.CREATE);
    if (!canUpdateConfig) {
      return NextResponse.json(
        { error: "Forbidden. You don't have permission to modify configuration." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { tokenId, feeAddress, decimals, latestMinterTx, noOfApproval, globalJson } = body;

    const mintAddress = PrivateKey.fromWif(await getMintWif()).toAddress();
    const burnAddress = PrivateKey.fromWif(await getBurnWif()).toAddress();

    // Get current config to keep existing fees and values
    const currentConfig = await prisma.config.findUnique({
      where: { id: 1 }
    });
    const defaultFees = [
      { min: 0, max: 10000, fee: 50 },
      { min: 10001, max: Number.MAX_SAFE_INTEGER, fee: 1000 }
    ];

    const config = await prisma.$transaction(async (tx) => {
      const upsertedConfig = await tx.config.upsert({
        where: { id: 1 },
        update: {
          tokenId,
          feeAddress,
          decimals,
          latestMinterTx,
          mintAddress,
          burnAddress,
          fees: currentConfig?.fees ?? defaultFees,
        },
        create: {
          id: 1,
          tokenId,
          feeAddress,
          decimals,
          latestMinterTx,
          fundAddress: "",
          mintAddress,
          burnAddress,
          fees: defaultFees,
          minNoOfApproval: noOfApproval ?? 2,
          maxNoOfApproval: 50,
          globalJson: globalJson ?? {},
        },
      });

      await logActivity(tx, {
        name: "Config Upserted",
        action: "CONFIG_UPSERT",
        description: `Configuration has been created or updated by user ${session.user.id}.`,
        metadata: {
          config: JSON.stringify(upsertedConfig, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
          userId: session.user.id,
          userEmail: session.user.email,
        },
      });

      return upsertedConfig;
    });

    // Revalidate cache after update
    await revalidateConfig();

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error saving config:", error);
    return NextResponse.json(
      { error: "Error saving configuration." },
      { status: 500 }
    );
  }
}, createAPIRateLimit())

export const PATCH = withCSRF(async function(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to modify configuration." },
        { status: 401 }
      );
    }

    // Check permission to update config
    const canUpdateConfig = await hasServerPermission(Resource.CONFIG, Action.UPDATE);
    if (!canUpdateConfig) {
      return NextResponse.json(
        { error: "Forbidden. You don't have permission to modify configuration." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { minNoOfApproval, maxNoOfApproval, globalJson } = body;

    const updatedConfig = await prisma.$transaction(async (tx) => {
      const config = await tx.config.update({
        where: { id: 1 },
        data: {
          ...(minNoOfApproval !== undefined ? { minNoOfApproval: minNoOfApproval } : {}),
          ...(maxNoOfApproval !== undefined ? { maxNoOfApproval: maxNoOfApproval } : {}),
          ...(globalJson !== undefined ? { globalJson } : {}),
        },
      });

      await logActivity(tx, {
        name: "Config Updated",
        action: "CONFIG_UPDATE",
        description: `Configuration has been updated by user ${session.user.id}.`,
        metadata: {
          config: JSON.stringify(config, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
          userId: session.user.id,
          userEmail: session.user.email,
          changes: { minNoOfApproval, maxNoOfApproval, globalJson },
        },
      });

      return config;
    });

    return NextResponse.json({ message: "Configuration updated." });
  } catch (error) {
    console.error("Error saving config:", error);
    return NextResponse.json(
      { error: "Error saving configuration." },
      { status: 500 }
    );
  }
}, createAPIRateLimit())
