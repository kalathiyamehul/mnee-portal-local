import { Resource, Action } from "@/lib/permission";
import { usePermission } from "@/hooks/usePermission";

export function PermissionExample() {
  const { hasPermission, hasAllPermissions, hasAnyPermission, loading } =
    usePermission();

  if (loading) {
    return <div>Loading permissions...</div>;
  }

  // Example of checking a single permission
  const canCreateUser = hasPermission(Resource.USER, Action.CREATE);

  // Example of checking multiple permissions (ALL)
  const canManageUsers = hasAllPermissions([
    { resource: Resource.USER, action: Action.CREATE },
    { resource: Resource.USER, action: Action.UPDATE },
    { resource: Resource.USER, action: Action.DELETE },
  ]);

  // Example of checking multiple permissions (ANY)
  const canViewEither = hasAnyPermission([
    { resource: Resource.USER, action: Action.READ },
    { resource: Resource.CUSTOMER, action: Action.READ },
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Single Permission Check:</h3>
        {canCreateUser ? (
          <button className="bg-blue-500 text-white px-4 py-2 rounded">
            Create User
          </button>
        ) : (
          <p className="text-red-500">You cannot create users</p>
        )}
      </div>

      <div>
        <h3 className="font-semibold">Multiple Permissions Check (ALL):</h3>
        {canManageUsers ? (
          <div className="space-x-2">
            <button className="bg-blue-500 text-white px-4 py-2 rounded">
              Create User
            </button>
            <button className="bg-green-500 text-white px-4 py-2 rounded">
              Update User
            </button>
            <button className="bg-red-500 text-white px-4 py-2 rounded">
              Delete User
            </button>
          </div>
        ) : (
          <p className="text-red-500">You cannot fully manage users</p>
        )}
      </div>

      <div>
        <h3 className="font-semibold">Multiple Permissions Check (ANY):</h3>
        {canViewEither ? (
          <p className="text-green-500">
            You can view either users or customers
          </p>
        ) : (
          <p className="text-red-500">
            You cannot view either users or customers
          </p>
        )}
      </div>
    </div>
  );
}
