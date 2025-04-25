import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Resource, Action } from "@/lib/permission";

interface Permission {
    resource: string;
    action: string;
}

interface UserRole {
    role: {
        name: string;
        rolePermissions: {
            permission: {
                resource: string;
                action: string;
            };
        }[];
    };
}

export function usePermission() {
    const { data: session } = useSession();
    const [userRoles, setUserRoles] = useState<UserRole[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserRoles = async () => {
            if (!session?.user?.id) {
                setUserRoles([]);
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`/api/user/roles?userId=${session.user.id}`);
                if (!response.ok) throw new Error("Failed to fetch user roles");
                const data = await response.json();
                setUserRoles(data);
            } catch (error) {
                console.error("Error fetching user roles:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserRoles();
    }, [session?.user?.id]);

    const hasPermission = useCallback(
        (resource: Resource, action: Action): boolean => {
            if (!session?.user?.id || loading) return false;

            // Check if user is super admin
            const isSuperAdmin = userRoles.some(
                (userRole) => userRole.role.name === "Super Admin"
            );
            if (isSuperAdmin) return true;

            // Check specific permissions
            return userRoles.some((userRole) =>
                userRole.role.rolePermissions.some(
                    (rp) =>
                        rp.permission.resource === resource &&
                        rp.permission.action === action
                )
            );
        },
        [session?.user?.id, loading, userRoles]
    );

    const hasAnyPermission = useCallback(
        (permissions: Permission[]): boolean => {
            return permissions.some((p) =>
                hasPermission(p.resource as Resource, p.action as Action)
            );
        },
        [hasPermission]
    );

    const hasAllPermissions = useCallback(
        (permissions: Permission[]): boolean => {
            return permissions.every((p) =>
                hasPermission(p.resource as Resource, p.action as Action)
            );
        },
        [hasPermission]
    );

    return {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        loading,
    };
} 