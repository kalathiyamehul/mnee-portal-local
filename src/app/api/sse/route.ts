import { NextRequest } from "next/server";
import { EventEmitter } from "events";

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
                    `event: mintUpdate\ndata: ${JSON.stringify(data)}\n\n`
                );
            };
            const onCancelUpdate = (data: any) => {
                controller.enqueue(
                    `event: cancelUpdate\ndata: ${JSON.stringify(data)}\n\n`
                );
            };

            // Listen for approval events
            emitter.on("mintUpdate", onApprovalUpdate);
            emitter.on("cancelUpdate", onCancelUpdate);

            // Clean up when the connection closes
            req.signal?.addEventListener("abort", () => {
                emitter.off("mintUpdate", onApprovalUpdate);
                emitter.off("cancelUpdate", onCancelUpdate);
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
    emitter.emit("mintUpdate", data);
}

export function emitCancelUpdate(data: any) {
    emitter.emit("cancelUpdate", data);
}