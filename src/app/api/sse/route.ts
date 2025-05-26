import { NextRequest } from "next/server";
import { EventEmitter } from "events";

// Create a global event emitter for server events
const globalEmitter = global as any;
if (!globalEmitter.sseEmitter) {
    globalEmitter.sseEmitter = new EventEmitter();
}
const emitter = globalEmitter.sseEmitter;
export const EVENTS = {
    MINT_UPDATE: "mintUpdate",
    CANCEL_UPDATE: "cancelUpdate",
    THREE_R_D_EVENTS_TEST: "3RDEventsTest",
};
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
            //3 rrd events test
            const on3RDEventsTest = (data: any) => {
                controller.enqueue(
                    `event: ${EVENTS.THREE_R_D_EVENTS_TEST}\ndata: ${JSON.stringify(data)}\n\n`
                );
            };

            // Listen for approval events
            emitter.on(EVENTS.MINT_UPDATE, onApprovalUpdate);
            emitter.on(EVENTS.CANCEL_UPDATE, onCancelUpdate);
            emitter.on(EVENTS.THREE_R_D_EVENTS_TEST, on3RDEventsTest);

            // Clean up when the connection closes
            req.signal?.addEventListener("abort", () => {
                emitter.off(EVENTS.MINT_UPDATE, onApprovalUpdate);
                emitter.off(EVENTS.CANCEL_UPDATE, onCancelUpdate);
                emitter.off(EVENTS.THREE_R_D_EVENTS_TEST, on3RDEventsTest);
                controller.close();
            });
        }
    });

    return new Response(stream, { headers });
}
// Helper function to emit events from API routes
export function emitMintUpdate(data: {
    activityId: string;
    approval: any;
    type: string;
}) {
    emitter.emit(EVENTS.MINT_UPDATE, data);
}

export function emitCancelUpdate(data: any) {
    emitter.emit(EVENTS.CANCEL_UPDATE, data);
}

export function emit3RDEventsTest(data: any) {
    emitter.emit(EVENTS.THREE_R_D_EVENTS_TEST, data);
}