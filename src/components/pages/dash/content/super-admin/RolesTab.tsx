"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Resource, Action, RESOURCE_PERMISSIONS } from "@/lib/permission";

interface Role {
  id: string;
  name: string;
  description?: string;
  rolePermissions: {
    permission: {
      id: string;
      name: string;
      resource: string;
      action: string;
    };
  }[];
}

interface PermissionGroup {
  resource: string;
  actions: string[];
}

export default function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newRole, setNewRole] = useState({
    name: "",
    description: "",
    permissions: [] as PermissionGroup[],
  });
  const [editingRole, setEditingRole] = useState<
    (Role & { permissions: PermissionGroup[] }) | null
  >(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await fetch("/api/role");
      if (!response.ok) throw new Error("Failed to fetch roles");
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      toast.error("Failed to fetch roles");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    try {
      const response = await fetch("/api/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRole.name,
          description: newRole.description,
          permissions: newRole.permissions.filter((p) => p.actions.length > 0),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create role");
      }
      toast.success("Role created successfully");
      fetchRoles();
      setIsCreating(false);
      setNewRole({ name: "", description: "", permissions: [] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create role"
      );
      console.error(error);
    }
  };

  const handleUpdateRole = async (roleId: string) => {
    if (!editingRole) return;

    try {
      const response = await fetch(`/api/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: roleId,
          name: editingRole.name,
          description: editingRole.description,
          permissions: editingRole.permissions.filter(
            (p) => p.actions.length > 0
          ),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      toast.success("Role updated successfully");
      fetchRoles();
      setIsEditing(false);
      setEditingRole(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update role"
      );
      console.error(error);
    }
  };

  // Helper to convert rolePermissions to permissions array
  const rolePermissionsToPermissions = (
    rolePermissions: Role["rolePermissions"]
  ): PermissionGroup[] => {
    const permissionMap: Record<string, string[]> = {};

    // Initialize all resources with empty arrays
    Object.values(Resource).forEach((resource) => {
      permissionMap[resource] = [];
    });

    // Fill in the actions from rolePermissions
    rolePermissions.forEach((rp) => {
      const { resource, action } = rp.permission;
      if (permissionMap[resource]) {
        permissionMap[resource].push(action);
      }
    });

    // Convert to PermissionGroup array
    return Object.entries(permissionMap).map(([resource, actions]) => ({
      resource,
      actions,
    }));
  };

  const handleStartEditing = (role: Role) => {
    const permissions = rolePermissionsToPermissions(role.rolePermissions);
    setEditingRole({ ...role, permissions });
    setIsEditing(true);
  };

  const handlePermissionChange = (
    resource: string,
    action: string,
    checked: boolean,
    isForEditing: boolean = false
  ) => {
    if (isForEditing && editingRole) {
      setEditingRole((prev) => {
        if (!prev) return null;

        const updatedPermissions = [...prev.permissions];
        const resourceIndex = updatedPermissions.findIndex(
          (p) => p.resource === resource
        );

        if (resourceIndex === -1 && checked) {
          // Resource not found and checkbox is checked, add new resource with action
          updatedPermissions.push({ resource, actions: [action] });
        } else if (resourceIndex !== -1) {
          // Resource found
          if (
            checked &&
            !updatedPermissions[resourceIndex].actions.includes(action)
          ) {
            // Add action to existing resource
            updatedPermissions[resourceIndex] = {
              ...updatedPermissions[resourceIndex],
              actions: [...updatedPermissions[resourceIndex].actions, action],
            };
          } else if (!checked) {
            // Remove action from resource
            updatedPermissions[resourceIndex] = {
              ...updatedPermissions[resourceIndex],
              actions: updatedPermissions[resourceIndex].actions.filter(
                (a) => a !== action
              ),
            };
          }
        }

        return {
          ...prev,
          permissions: updatedPermissions,
        };
      });
    } else {
      setNewRole((prev) => {
        const updatedPermissions = [...prev.permissions];
        const resourceIndex = updatedPermissions.findIndex(
          (p) => p.resource === resource
        );

        if (resourceIndex === -1 && checked) {
          // Resource not found and checkbox is checked, add new resource with action
          updatedPermissions.push({ resource, actions: [action] });
        } else if (resourceIndex !== -1) {
          // Resource found
          if (
            checked &&
            !updatedPermissions[resourceIndex].actions.includes(action)
          ) {
            // Add action to existing resource
            updatedPermissions[resourceIndex] = {
              ...updatedPermissions[resourceIndex],
              actions: [...updatedPermissions[resourceIndex].actions, action],
            };
          } else if (!checked) {
            // Remove action from resource
            updatedPermissions[resourceIndex] = {
              ...updatedPermissions[resourceIndex],
              actions: updatedPermissions[resourceIndex].actions.filter(
                (a) => a !== action
              ),
            };
          }
        }

        return {
          ...prev,
          permissions: updatedPermissions,
        };
      });
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;

    try {
      const response = await fetch(`/api/role?id=${roleId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete role");
      }

      toast.success("Role deleted successfully");
      fetchRoles();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete role"
      );
      console.error(error);
    }
  };

  // Helper to check if a permission is active
  const isPermissionActive = (
    resource: string,
    action: string,
    forEditing: boolean = false
  ) => {
    if (forEditing && editingRole) {
      const resourcePermission = editingRole.permissions.find(
        (p) => p.resource === resource
      );
      return resourcePermission?.actions.includes(action) || false;
    } else {
      const resourcePermission = newRole.permissions.find(
        (p) => p.resource === resource
      );
      return resourcePermission?.actions.includes(action) || false;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Role Management</h1>
        <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
          Create New Role
        </button>
      </div>

      {/* Create Role Modal */}
      {isCreating && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg mb-4">Create New Role</h3>
            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Role Name</span>
              </label>
              <input
                type="text"
                placeholder="Enter role name"
                className="input input-bordered w-full"
                value={newRole.name}
                onChange={(e) =>
                  setNewRole((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Description</span>
              </label>
              <textarea
                placeholder="Enter role description"
                className="textarea textarea-bordered w-full"
                value={newRole.description}
                onChange={(e) =>
                  setNewRole((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="mb-4">
              <label className="label">
                <span className="label-text">Permissions</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {RESOURCE_PERMISSIONS.map((resource) => (
                  <div key={resource.name} className="card bg-base-200">
                    <div className="card-body p-4">
                      <h3 className="card-title text-sm mb-2">
                        {resource.name}
                      </h3>
                      <div className="space-y-2">
                        {resource.permissions.map((action) => (
                          <label
                            key={action}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={isPermissionActive(
                                resource.name,
                                action
                              )}
                              onChange={(e) =>
                                handlePermissionChange(
                                  resource.name,
                                  action,
                                  e.target.checked
                                )
                              }
                            />
                            <span className="text-sm">{action}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-action">
              <button className="btn" onClick={() => setIsCreating(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateRole}
                disabled={!newRole.name.trim()}
              >
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {isEditing && editingRole && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg mb-4">Edit Role</h3>
            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Role Name</span>
              </label>
              <input
                type="text"
                placeholder="Enter role name"
                className="input input-bordered w-full"
                value={editingRole.name}
                onChange={(e) =>
                  setEditingRole((prev) =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
              />
            </div>

            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Description</span>
              </label>
              <textarea
                placeholder="Enter role description"
                className="textarea textarea-bordered w-full"
                value={editingRole.description || ""}
                onChange={(e) =>
                  setEditingRole((prev) =>
                    prev ? { ...prev, description: e.target.value } : null
                  )
                }
              />
            </div>

            <div className="mb-4">
              <label className="label">
                <span className="label-text">Permissions</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {RESOURCE_PERMISSIONS.map((resource) => (
                  <div key={resource.name} className="card bg-base-200">
                    <div className="card-body p-4">
                      <h3 className="card-title text-sm mb-2">
                        {resource.name}
                      </h3>
                      <div className="space-y-2">
                        {resource.permissions.map((action) => (
                          <label
                            key={action}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={isPermissionActive(
                                resource.name,
                                action,
                                true
                              )}
                              onChange={(e) =>
                                handlePermissionChange(
                                  resource.name,
                                  action,
                                  e.target.checked,
                                  true
                                )
                              }
                            />
                            <span className="text-sm">{action}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setIsEditing(false);
                  setEditingRole(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleUpdateRole(editingRole.id)}
                disabled={!editingRole.name.trim()}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roles List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div key={role.id} className="card bg-base-200">
            <div className="card-body">
              <div className="flex justify-between items-start">
                <h2 className="card-title">{role.name}</h2>
                <div className="flex gap-2">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleStartEditing(role)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-ghost text-error"
                    onClick={() => handleDeleteRole(role.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {role.description && (
                <p className="text-sm text-base-content/70">
                  {role.description}
                </p>
              )}
              <div className="divider my-2"></div>
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Permissions:</h3>
                {Object.values(Resource).map((resource) => {
                  const resourcePermissions = role.rolePermissions
                    .filter((rp) => rp.permission.resource === resource)
                    .map((rp) => rp.permission.action);

                  if (resourcePermissions.length === 0) return null;

                  return (
                    <div key={resource} className="text-sm">
                      <span className="font-medium">{resource}:</span>{" "}
                      {resourcePermissions.join(", ")}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}