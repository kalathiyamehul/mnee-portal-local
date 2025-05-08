import { Resource, Action } from "@/lib/permission";
import { usePermission } from "@/hooks/usePermission";

export function PermissionExample() {
  const { hasPermission, hasAllPermissions, hasAnyPermission, loading } =
    usePermission();

  if (loading) {
    return <div>Loading permissions...</div>;
  }
  // Example: Check if user can see Wallet menu
  const canViewWallet = hasPermission(Resource.WALLET, Action.READ);
  // Example: Check if user can see Customers menu
  const canViewCustomers = hasPermission(Resource.CUSTOMER, Action.READ);
  // Example: Check if user can see SuperAdmin menu (any super admin permission)
  const canViewSuperAdmin = hasAnyPermission([
    { resource: Resource.SUPER_ADMIN, action: Action.READ },
    { resource: Resource.SUPER_ADMIN, action: Action.CREATE },
    { resource: Resource.SUPER_ADMIN, action: Action.UPDATE },
    { resource: Resource.SUPER_ADMIN, action: Action.DELETE },
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Sidebar Permission Checks:</h3>
        <ul className="list-disc ml-6">
          <li>
            Wallet menu:{" "}
            {canViewWallet ? (
              <span className="text-green-600">Visible</span>
            ) : (
              <span className="text-red-600">Hidden</span>
            )}
          </li>
          <li>
            Customers menu:{" "}
            {canViewCustomers ? (
              <span className="text-green-600">Visible</span>
            ) : (
              <span className="text-red-600">Hidden</span>
            )}
          </li>
          <li>
            SuperAdmin menu:{" "}
            {canViewSuperAdmin ? (
              <span className="text-green-600">Visible</span>
            ) : (
              <span className="text-red-600">Hidden</span>
            )}
          </li>
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Single Permission Check:</h3>
        {canViewWallet ? (
          <button className="bg-blue-500 text-white px-4 py-2 rounded">
            Access Wallet
          </button>
        ) : (
          <p className="text-red-500">You cannot access the wallet</p>
        )}
      </div>
    </div>
  );
}
