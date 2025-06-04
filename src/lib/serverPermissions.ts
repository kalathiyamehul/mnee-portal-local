import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { Resource, Action } from "@/lib/permission";

export async function hasServerPermission(resource: Resource, action: Action): Promise<boolean> {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return false;
    }

    const rolePermissions = session?.user?.rolePermissions;

    // Super admin has all permissions (empty rolePermissions array indicates super admin)
    if (Array.isArray(rolePermissions) && rolePermissions.length === 0) {
        return true;
    }

    // Check if user has the specific permission
    if (!rolePermissions || typeof rolePermissions !== "object") {
        return false;
    }

    return rolePermissions[resource]?.includes(action) ?? false;
}