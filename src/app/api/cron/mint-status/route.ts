import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitMintUpdate } from '@/lib/sseEmitter';
import { MNEE_API } from '@/env';
import { ActivityAction, logActivity } from '@/lib/activityLogger';

// Type definitions for request processing
type RequestType = 'MINT' | 'BURN';
type ProcessableRequest = {
  id: string;
  ticket_id: string;
  updatedAt: Date;
  type: RequestType;
  data: any;
};

// Function to check transaction status from external API
async function checkTransactionStatus(txid: string): Promise<{ status: 'SUCCESS' | 'FAILED' | 'PENDING'; tx_hex?: string, tx_id?: string }> {
  try {
    // Validate txid parameter
    if (!txid || typeof txid !== 'string' || txid.trim() === '') {
      console.error(`Invalid txid provided: ${txid}`);
      return { status: 'FAILED' };
    }

    // Validate API URL
    if (!MNEE_API || typeof MNEE_API !== 'string' || MNEE_API.trim() === '') {
      console.error(`Invalid MNEE_API configuration: ${MNEE_API}`);
      return { status: 'FAILED' };
    }

    // Construct URL safely
    let apiUrl;
    try {
      const baseUrl = MNEE_API.endsWith('/') ? MNEE_API.slice(0, -1) : MNEE_API;
      apiUrl = `${baseUrl}/v1/ticket?ticketID=${encodeURIComponent(txid)}`;
    } catch (urlError) {
      console.error(`Error constructing API URL for txid ${txid}:`, urlError);
      return { status: 'FAILED' };
    }

    // Create fetch options explicitly to avoid payload issues
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      // Explicitly set body to undefined for GET requests
      body: undefined
    };

    let response;
    try {
      response = await fetch(apiUrl, fetchOptions);
    } catch (fetchError) {
      console.error(`Fetch error for txid ${txid}:`, fetchError);
      if (fetchError instanceof TypeError && fetchError.message.includes('payload')) {
        console.error(`Payload error in fetch for txid ${txid}:`, {
          errorMessage: fetchError.message,
          errorCode: (fetchError as any).code,
          stack: fetchError.stack,
          url: apiUrl,
          fetchOptions: JSON.stringify(fetchOptions)
        });
      }
      return { status: 'PENDING' };
    }
    
    if (!response.ok) {
      console.error(`API request failed for txid ${txid}: ${response.status} ${response.statusText}`);
      if (response.status === 404) {
        return { status: 'PENDING' };
      }
      return { status: 'FAILED' };
    }

    // Check if response has content before parsing JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error(`Invalid content type for txid ${txid}: ${contentType}`);
      return { status: 'PENDING' };
    }

    // Get response text first to check if it's empty
    let responseText;
    try {
      responseText = await response.text();
    } catch (textError) {
      console.error(`Error reading response text for txid ${txid}:`, textError);
      if (textError instanceof TypeError && textError.message.includes('payload')) {
        console.error(`Payload error in response.text() for txid ${txid}:`, {
          errorMessage: textError.message,
          errorCode: (textError as any).code,
          stack: textError.stack
        });
      }
      return { status: 'PENDING' };
    }

    if (!responseText || responseText.trim() === '') {
      console.error(`Empty response body for txid ${txid}`);
      return { status: 'PENDING' };
    }

    // Parse JSON safely
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`JSON parse error for txid ${txid}:`, parseError);
      return { status: 'PENDING' };
    }

    // Validate response data structure
    if (!data || typeof data !== 'object') {
      console.error(`Invalid response data structure for txid ${txid}:`, data);
      return { status: 'PENDING' };
    }

    if (data.status === "SUCCESS") {
      return {
        status: 'SUCCESS',
        tx_hex: data.tx_hex || undefined,
        tx_id: data.tx_id || undefined
      };
    } else if (data.status === "FAILED") {
      return {
        status: 'FAILED'
      };
    }

    // If status is not SUCCESS or FAILED, consider it pending
    return { status: 'PENDING' };
  } catch (error) {
    console.error(`Error checking transaction status for ${txid}:`, error);
    // Log additional error details for debugging
    if (error instanceof TypeError && error.message.includes('payload')) {
      console.error(`Payload error details for txid ${txid}:`, {
        errorMessage: error.message,
        errorCode: (error as any).code,
        stack: error.stack
      });
    }
    return { status: 'PENDING' };
  }
}
// Function to update mint request based on transaction status
async function updateMintRequestStatus(
  mintRequest: any,
  transactionStatus: { status: 'SUCCESS' | 'FAILED' | 'PENDING'; tx_hex?: string, tx_id?: string }
) {
  const { status, tx_hex, tx_id } = transactionStatus;
  
  if (status === 'SUCCESS') {
    // Update config with latest minter transaction if available
    if (tx_hex) {
      await prisma.config.updateMany({
        data: { latestMinterTx: tx_hex }
      });
    }
    
    // Emit SSE update
    emitMintUpdate({
      activityId: mintRequest.id,
      approval: "Mint Request Fully Approved",
      type: "APPROVED",
    });
    
    // Update mint request status to DONE
    await prisma.$transaction(async (tx) => {
      await tx.mintRequest.update({
        where: { id: mintRequest.id },
        data: {
          status: "DONE",
          txid: tx_id,
          updatedAt: new Date()
        }
      });
      
      await logActivity(tx, {
        action: ActivityAction.MINT_TX_COMPLETED,
        metadata: {
          mintRequestId: mintRequest.id,
          txid: mintRequest.txid,
          source: 'cron_job'
        },
      });
    });
    
    console.log(`✅ Mint request ${mintRequest.id} marked as DONE via cron job`);
    
  } else if (status === 'FAILED') {
    // Emit SSE update
    emitMintUpdate({
      activityId: mintRequest.id,
      approval: "Mint Request Failed",
      type: "FAILED",
    });
    
    // Update mint request status to FAILED
    await prisma.$transaction(async (tx) => {
      await tx.mintRequest.update({
        where: { id: mintRequest.id },
        data: {
          status: "FAILED",
          updatedAt: new Date()
        }
      });
      
      await logActivity(tx, {
        action: ActivityAction.MINT_TX_FAILED,
        metadata: {
          mintRequestId: mintRequest.id,
          txid: mintRequest.txid,
          source: 'cron_job'
        },
      });
    });
    
    console.log(`❌ Mint request ${mintRequest.id} marked as FAILED via cron job`);
  }
}
// Function to update burn request based on transaction status
async function updateBurnRequestStatus(
  burnRequest: any,
  transactionStatus: { status: 'SUCCESS' | 'FAILED' | 'PENDING'; tx_hex?: string, tx_id?: string }
) {
  const { status, tx_hex, tx_id } = transactionStatus;

  if (status === 'SUCCESS') {
    // Update config with latest minter transaction if available
    if (tx_hex) {
      await prisma.config.updateMany({
        data: { latestMinterTx: tx_hex }
      });
    }

    // Emit SSE update for burn
    emitMintUpdate({
      activityId: burnRequest.id,
      approval: "Burn Request Completed",
      type: "APPROVED",
    });

    // Update burn request status to DONE
    await prisma.$transaction(async (tx) => {
      await tx.burnRequest.update({
        where: { id: burnRequest.id },
        data: {
          status: "DONE",
          txid: tx_id || burnRequest.txid,
          updatedAt: new Date()
        }
      });

      await logActivity(tx, {
        action: ActivityAction.BURN_REQUEST_FULLY_APPROVED,
        metadata: {
          burnRequestId: burnRequest.id,
          txid: burnRequest.txid,
          source: 'cron_job'
        },
      });
    });

    console.log(`✅ Burn request ${burnRequest.id} marked as DONE via cron job`);

  } else if (status === 'FAILED') {
    // Emit SSE update for burn failure
    emitMintUpdate({
      activityId: burnRequest.id,
      approval: "Burn Request Failed",
      type: "FAILED",
    });

    // Update burn request status to FAILED
    await prisma.$transaction(async (tx) => {
      await tx.burnRequest.update({
        where: { id: burnRequest.id },
        data: {
          status: "FAILED",
          updatedAt: new Date()
        }
      });

      await logActivity(tx, {
        action: ActivityAction.BURN_REQUEST_REJECT,
        metadata: {
          burnRequestId: burnRequest.id,
          txid: burnRequest.txid,
          source: 'cron_job'
        },
      });
    });

    console.log(`❌ Burn request ${burnRequest.id} marked as FAILED via cron job`);
  }
}
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting mint and burn status cron job...');
    
    // Calculate the time threshold (5 minutes ago)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    // Find approved mint requests that are older than 5 minutes and have a txid
    let approvedMintRequests: any[] = [];
    try {
      console.log("Fetching Mint")
      approvedMintRequests = await prisma.mintRequest.findMany({
        where: {
          status: 'APPROVED',
          updatedAt: {
            lt: fiveMinutesAgo
          }
        },
        orderBy: {
          updatedAt: 'asc'
        },
        take: 10 // Limit to 10 mint requests
      });
    } catch (mintQueryError) {
      console.error('❌ Error querying mint requests:', mintQueryError?.toString());
      approvedMintRequests = [];
    }
    console.log("Mint transection", approvedMintRequests)
    // Find approved burn requests that are older than 5 minutes and have a txid
    let approvedBurnRequests: any[] = [];
    try {
      console.log("Fetching Burn")
      approvedBurnRequests = await prisma.burnRequest.findMany({
        where: {
          status: 'APPROVED',
          updatedAt: {
            lt: fiveMinutesAgo
          }
        },
        orderBy: {
          updatedAt: 'asc'
        },
        take: 10 // Limit to 10 burn requests
      });
    } catch (burnQueryError) {
      console.error('❌ Error querying burn requests:', burnQueryError?.toString());
      approvedBurnRequests = [];
    }
    console.log("Burn transection", approvedBurnRequests)
    console.log(`📋 Found ${approvedMintRequests.length} approved mint requests and ${approvedBurnRequests.length} approved burn requests to check`);

    // Combine and sort all requests by updatedAt with validation
    const allRequests: ProcessableRequest[] = [];

    try {
      // Safely map mint requests
      if (Array.isArray(approvedMintRequests)) {
        const validMintRequests = approvedMintRequests
          .filter(req => req && req.id && req.ticket_id && req.updatedAt)
          .map(req => ({
            id: req.id,
            ticket_id: req.ticket_id,
            updatedAt: req.updatedAt,
            type: 'MINT' as RequestType,
            data: req
          }));
        allRequests.push(...validMintRequests);
      }

      // Safely map burn requests
      if (Array.isArray(approvedBurnRequests)) {
        const validBurnRequests = approvedBurnRequests
          .filter(req => req && req.id && req.ticket_id && req.updatedAt)
          .map(req => ({
            id: req.id,
            ticket_id: req.ticket_id,
            updatedAt: req.updatedAt,
            type: 'BURN' as RequestType,
            data: req
          }));
        allRequests.push(...validBurnRequests);
      }

      // Sort by updatedAt with error handling
      allRequests.sort((a, b) => {
        try {
          return a.updatedAt.getTime() - b.updatedAt.getTime();
        } catch (sortError) {
          console.error('❌ Error sorting requests:', sortError);
          return 0;
        }
      });
    } catch (mappingError) {
      console.error('❌ Error mapping and sorting requests:', mappingError);
    }
    console.log("allRequests", allRequests)
    if (allRequests.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No approved requests to check',
        processed: 0
      });
    }
    
    let mintSuccessCount = 0;
    let mintFailedCount = 0;
    let mintPendingCount = 0;
    let burnSuccessCount = 0;
    let burnFailedCount = 0;
    let burnPendingCount = 0;
    
    // Process each request in sequence based on updatedAt order
    for (const request of allRequests) {
      try {
        // Validate request data
        if (!request || !request.id || !request.ticket_id || !request.type || !request.data) {
          console.error(`❌ Invalid request data:`, request);
          continue;
        }

        console.log(`🔍 Checking status for ${request.type.toLowerCase()} request ${request.id} with txid ${request.ticket_id}`);

        // Check transaction status with additional validation
        const transactionStatus = await checkTransactionStatus(request.ticket_id);

        if (!transactionStatus || !transactionStatus.status) {
          console.error(`❌ Invalid transaction status response for ${request.ticket_id}:`, transactionStatus);
          continue;
        }

        console.log(`📊 Transaction ${request.ticket_id} status: ${transactionStatus.status}`);

        // Update request based on type and status
        if (request.type === 'MINT') {
          try {
            await updateMintRequestStatus(request.data, transactionStatus);

            // Update mint counters
            if (transactionStatus.status === 'SUCCESS') {
              mintSuccessCount++;
            } else if (transactionStatus.status === 'FAILED') {
              mintFailedCount++;
            } else {
              mintPendingCount++;
            }
          } catch (mintError) {
            console.error(`❌ Error updating mint request ${request.id}:`, mintError);
            mintFailedCount++; // Count as failed if update fails
          }
        } else if (request.type === 'BURN') {
          try {
            await updateBurnRequestStatus(request.data, transactionStatus);

            // Update burn counters
            if (transactionStatus.status === 'SUCCESS') {
              burnSuccessCount++;
            } else if (transactionStatus.status === 'FAILED') {
              burnFailedCount++;
            } else {
              burnPendingCount++;
            }
          } catch (burnError) {
            console.error(`❌ Error updating burn request ${request.id}:`, burnError);
            burnFailedCount++; // Count as failed if update fails
          }
        } else {
          console.error(`❌ Unknown request type: ${request.type}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${request.type?.toLowerCase() || 'unknown'} request ${request.id || 'unknown'}:`, error);

        // Log additional error details for debugging
        if (error instanceof TypeError && error.message.includes('payload')) {
          console.error(`Payload error details:`, {
            requestId: request.id,
            ticketId: request.ticket_id,
            requestType: request.type,
            errorMessage: error.message,
            errorCode: (error as any).code,
            stack: error.stack
          });
        }

        // Increment failed counter based on request type
        if (request.type === 'MINT') {
          mintFailedCount++;
        } else if (request.type === 'BURN') {
          burnFailedCount++;
        }
      }
    }
    
    // Safely construct summary with error handling
    let summary;
    try {
      summary = {
        success: true,
        message: 'Mint and burn status cron job completed',
        processed: allRequests?.length || 0,
        results: {
          mint: {
            success: mintSuccessCount || 0,
            failed: mintFailedCount || 0,
            pending: mintPendingCount || 0
          },
          burn: {
            success: burnSuccessCount || 0,
            failed: burnFailedCount || 0,
            pending: burnPendingCount || 0
          },
          total: {
            success: (mintSuccessCount || 0) + (burnSuccessCount || 0),
            failed: (mintFailedCount || 0) + (burnFailedCount || 0),
            pending: (mintPendingCount || 0) + (burnPendingCount || 0)
          }
        },
        timestamp: new Date().toISOString()
      };
    } catch (summaryError) {
      console.error('❌ Error constructing summary:', summaryError);
      summary = {
        success: true,
        message: 'Mint and burn status cron job completed with errors',
        processed: 0,
        results: {
          mint: { success: 0, failed: 0, pending: 0 },
          burn: { success: 0, failed: 0, pending: 0 },
          total: { success: 0, failed: 0, pending: 0 }
        },
        timestamp: new Date().toISOString(),
        error: 'Failed to construct proper summary'
      };
    }
    
    console.log('✅ Mint and burn status cron job completed:', summary);
    
    try {
      return NextResponse.json(summary);
    } catch (responseError) {
      console.error('❌ Error creating JSON response:', responseError);
      return NextResponse.json({
        success: false,
        message: 'Failed to create response',
        error: 'Response serialization error',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Mint and burn status cron job error:', error);

    // Log additional error details for debugging
    if (error instanceof TypeError && error.message.includes('payload')) {
      console.error('❌ Payload error in main catch block:', {
        errorMessage: error.message,
        errorCode: (error as any).code,
        stack: error.stack
      });
    }
    
    // Safely construct error response
    let errorResponse;
    try {
      errorResponse = {
        success: false,
        message: 'Failed to process mint and burn status cron job',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        timestamp: new Date().toISOString()
      };
    } catch (responseConstructionError) {
      console.error('❌ Error constructing error response:', responseConstructionError);
      errorResponse = {
        success: false,
        message: 'Critical error in cron job',
        error: 'Failed to construct error response',
        timestamp: new Date().toISOString()
      };
    }

    try {
      return NextResponse.json(errorResponse, { status: 500 });
    } catch (finalError) {
      console.error('❌ Critical error creating error response:', finalError);
      // Return a minimal response as last resort
      return new NextResponse(
        JSON.stringify({
          success: false,
          message: 'Critical system error',
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
}