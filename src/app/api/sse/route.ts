import { NextRequest } from "next/server";
import { EventEmitter } from "events";
import { EVENTS } from "@/lib/sseEmitter";

// Create a global event emitter for server events
const globalEmitter = global as any;
if (!globalEmitter.sseEmitter) {
    globalEmitter.sseEmitter = new EventEmitter();
}
const emitter = globalEmitter.sseEmitter;

export async function GET(req: NextRequest) {
    // Set headers for SSE
    const headers = new Headers({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    });

    // Create a readable stream
    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection message
            controller.enqueue(
                `data: ${JSON.stringify({ connected: true })}\n\n`
            );

            // Handle approval updates
            const onApprovalUpdate = (data: any) => {
                controller.enqueue(
                    `event: ${EVENTS.MINT_UPDATE}\ndata: ${JSON.stringify(data)}\n\n`
                );
            };
            const onCancelUpdate = (data: any) => {
                controller.enqueue(
                    `event: ${EVENTS.CANCEL_UPDATE}\ndata: ${JSON.stringify(data)}\n\n`
                );
            };
            // Customer update
            const onCustomerUpdate = (data: any) => {
                controller.enqueue(
                    `event: ${EVENTS.CUSTOMER_UPDATE}\ndata: ${JSON.stringify(data)}\n\n`
                );
            };
            // Restrictions update
            const onRestrictionsUpdate = (data: any) => {
                controller.enqueue(
                    `event: ${EVENTS.RESTRICTIONS_UPDATE}\ndata: ${JSON.stringify(data)}\n\n`
                );
            };
            // Burn update
            const onburnUpdate = (data: any) => {
                controller.enqueue(
                    `event: ${EVENTS.BURN_UPDATE}\ndata: ${JSON.stringify(data)}\n\n`
                );
            };
            // Refund update
            const onrefundUpdate = (data: any) => {
                controller.enqueue(
                    `event: ${EVENTS.REFUND_UPDATE}\ndata: ${JSON.stringify(data)}\n\n`
                );
            };

            // Role update
            const onRoleUpdate = (data: any) => {
                controller.enqueue(
                    `event: ${EVENTS.ROLE_UPDATE}\ndata: ${JSON.stringify(data)}\n\n`
                );
            };

            // System update
            const onSystemUpdate = (data: any) => {
                controller.enqueue(
                    `event: ${EVENTS.SYSTEM_UPDATE}\ndata: ${JSON.stringify(data)}\n\n`
                );
            };

            // User session invalidation
            const onUserSessionInvalidate = (data: any) => {
                controller.enqueue(
                    `event: ${EVENTS.USER_SESSION_INVALIDATE}\ndata: ${JSON.stringify(data)}\n\n`
                );
            };

            // Password changed
            const onPasswordChanged = (data: any) => {
                controller.enqueue(
                    `event: ${EVENTS.PASSWORD_CHANGED}\ndata: ${JSON.stringify(data)}\n\n`
                );
            };

            // Listen for approval events
            emitter.on(EVENTS.MINT_UPDATE, onApprovalUpdate);
            emitter.on(EVENTS.CANCEL_UPDATE, onCancelUpdate);
            emitter.on(EVENTS.CUSTOMER_UPDATE, onCustomerUpdate);
            emitter.on(EVENTS.RESTRICTIONS_UPDATE, onRestrictionsUpdate);
            emitter.on(EVENTS.BURN_UPDATE, onburnUpdate);
            emitter.on(EVENTS.REFUND_UPDATE, onrefundUpdate);
            emitter.on(EVENTS.ROLE_UPDATE, onRoleUpdate);
            emitter.on(EVENTS.USER_SESSION_INVALIDATE, onUserSessionInvalidate);
            emitter.on(EVENTS.PASSWORD_CHANGED, onPasswordChanged);
            emitter.on(EVENTS.SYSTEM_UPDATE, onSystemUpdate);


            // Clean up when the connection closes
            req.signal?.addEventListener("abort", () => {
                emitter.off(EVENTS.MINT_UPDATE, onApprovalUpdate);
                emitter.off(EVENTS.CANCEL_UPDATE, onCancelUpdate);
                emitter.off(EVENTS.CUSTOMER_UPDATE, onCustomerUpdate);
                emitter.off(EVENTS.RESTRICTIONS_UPDATE, onRestrictionsUpdate);
                emitter.off(EVENTS.BURN_UPDATE, onburnUpdate);
                emitter.off(EVENTS.REFUND_UPDATE, onrefundUpdate);
                emitter.off(EVENTS.ROLE_UPDATE, onRoleUpdate);
                emitter.off(EVENTS.USER_SESSION_INVALIDATE, onUserSessionInvalidate);
                emitter.off(EVENTS.PASSWORD_CHANGED, onPasswordChanged);
                emitter.off(EVENTS.SYSTEM_UPDATE, onSystemUpdate);
                controller.close();
            });
        }
    });

    return new Response(stream, { headers });
}