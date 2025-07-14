import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ActivityAction, logActivity } from '@/lib/activityLogger';
import { emitMintUpdate } from '@/lib/sseEmitter';

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));
    if (body.status === "SUCCESS") {
      if (body.action_requested = "mint") {
        const latestMinterTx = body?.tx_hex;
        await prisma.config.update({
          where: {
            id: 1
          },
          data: {
            latestMinterTx: latestMinterTx
          }
        });
        const mintRequest = await prisma.mintRequest.findFirst({
          where: {
            txid: body?.id
          }
        });
        if (mintRequest) {
          emitMintUpdate({
            activityId: mintRequest?.id,
            approval: "Mint Request Fully Approved",
            type: "APPROVED",
          });
          await prisma.$transaction(async (tx) => {
            // await logActivity(tx, {
            //   action: ActivityAction.MINT_TX_COMPLETED,
            //   metadata: {
            //     mintRequestId: mintRequest?.id,
            //     txid: body?.id,
            //   },
            // });
            await tx.mintRequest.update({
              where: {
                id: mintRequest?.id
              },
              data: {
                status: "DONE",
                txid: body?.tx_id,
                updatedAt: new Date()
              }
            });
          });
        }
      }
    }
    // Return success response
    return NextResponse.json(
      { 
        success: true, 
        message: 'Webhook received successfully',
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    // Try to get raw body if JSON parsing fails
    try {
      const text = await request.text();
      console.log('Webhook raw body:', text);
    } catch (textError) {
      console.error('Failed to read request body:', textError);
    }
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process webhook',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
}