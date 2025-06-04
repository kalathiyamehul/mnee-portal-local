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
    ROLE_UPDATE: "roleUpdate",
    USER_SESSION_INVALIDATE: "userSessionInvalidate",
    PASSWORD_CHANGED: "passwordChanged",
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

export function emitRoleUpdate(data: {
    roleId: string;
    roleName: string;
    action: 'created' | 'updated' | 'deleted';
    affectedUserIds?: string[];
}) {
    emitter.emit(EVENTS.ROLE_UPDATE, data);
}

export function emitUserSessionInvalidate(data: {
    userIds: string[];
    reason: 'role_updated' | 'role_assigned' | 'role_deleted' | 'password_changed';
    roleId?: string;
    roleName?: string;
    userEmail?: string;
}) {
    emitter.emit(EVENTS.USER_SESSION_INVALIDATE, data);
}

export function emitPasswordChanged(data: {
    userId: string;
    userEmail: string;
}) {
    emitter.emit(EVENTS.PASSWORD_CHANGED, data);
    // Also emit session invalidation for the user who changed password
    emitter.emit(EVENTS.USER_SESSION_INVALIDATE, {
        userIds: [data.userId],
        reason: 'password_changed',
        userEmail: data.userEmail
    });
} 