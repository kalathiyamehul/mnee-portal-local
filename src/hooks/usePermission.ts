import { useSession } from "next-auth/react";
import { useCallback } from "react";
import { Resource, Action } from "@/lib/permission";

export function usePermission() {
    const { data: session, status } = useSession();
    console.log("session", session);
    const loading = status === "loading";
    const rolePermissions = session?.user?.rolePermissions;
    const isSuperAdmin = Array.isArray(rolePermissions) && rolePermissions.length === 0;
    console.log("isSuperAdmin", isSuperAdmin);
    const hasPermission = useCallback(
        (resource: Resource, action: Action): boolean => {
            // if (loading) return false;
            if (isSuperAdmin) return true;
            if (!rolePermissions || typeof rolePermissions !== "object") return false;
            return (
                rolePermissions[resource]?.includes(action) ?? false
            );
        },
        [loading, isSuperAdmin, rolePermissions]
    );

    const hasAnyPermission = useCallback(
        (permissions: { resource: string; action: string }[]): boolean =>
            permissions.some((p) => hasPermission(p.resource as Resource, p.action as Action)),
        [hasPermission]
    );

    const hasAllPermissions = useCallback(
        (permissions: { resource: string; action: string }[]): boolean =>
            permissions.every((p) => hasPermission(p.resource as Resource, p.action as Action)),
        [hasPermission]
    );

    return {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        loading,
    };
} 