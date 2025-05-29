import { EventEmitter } from "events";

// Create a global event emitter for server events
const globalEmitter = global as any;
if (!globalEmitter.sseEmitter) {
    globalEmitter.sseEmitter = new EventEmitter();
}
export const emitter = globalEmitter.sseEmitter;

export const EVENTS = {
    MINT_UPDATE: "mintUpdate",
    CANCEL_UPDATE: "cancelUpdate",
    CUSTOMER_UPDATE: "customerUpdate",
    RESTRICTIONS_UPDATE: "restrictionsUpdate",
    BURN_UPDATE: "burnUpdate",
    REFUND_UPDATE: "refundUpdate",
};

// Helper functions to emit events from API routes
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

export function emitCustomerUpdate(data: any) {
    emitter.emit(EVENTS.CUSTOMER_UPDATE, data);
}

export function emitRestrictionsUpdate(data: any) {
    emitter.emit(EVENTS.RESTRICTIONS_UPDATE, data);
}

export function emitburnUpdate(data: any) {
    emitter.emit(EVENTS.BURN_UPDATE, data);
}

export function emitrefundUpdate(data: any) {
    emitter.emit(EVENTS.REFUND_UPDATE, data);
} 