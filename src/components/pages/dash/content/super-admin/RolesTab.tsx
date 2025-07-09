"use client";

import { useState, useEffect } from "react";
import { Resource, Action, RESOURCE_PERMISSIONS } from "@/lib/permission";
import { apiFetch } from "@/utils/api";
import CustomToast from "@/components/common/CustomToast";

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

  // Add validation functions
  const validateRoleName = (name: string): boolean => {
    // Only allow alphabetic characters and spaces, max 256 characters
    const regex = /^[A-Za-z\s]*$/;
    return regex.test(name) && name.length <= 256;
  };

  const validateDescription = (description: string): boolean => {
    // Max 512 characters
    return description.length <= 512;
  };

  const handleRoleNameChange = (value: string, isEditing: boolean = false) => {
    if (validateRoleName(value)) {
      if (isEditing) {
        setEditingRole((prev) => (prev ? { ...prev, name: value } : null));
      } else {
        setNewRole((prev) => ({ ...prev, name: value }));
      }
    }
  };

  const handleDescriptionChange = (
    value: string,
    isEditing: boolean = false
  ) => {
    if (validateDescription(value)) {
      if (isEditing) {
        setEditingRole((prev) =>
          prev ? { ...prev, description: value } : null
        );
      } else {
        setNewRole((prev) => ({ ...prev, description: value }));
      }
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await apiFetch("/api/role");
      if (!response.ok) throw new Error("Failed to fetch roles");
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      CustomToast.error("Failed to fetch roles");
      // console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    try {
      const response = await apiFetch("/api/role", {
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
      CustomToast.success("Role created successfully");
      fetchRoles();
      setIsCreating(false);
      setNewRole({ name: "", description: "", permissions: [] });
    } catch (error) {
      CustomToast.error(
        error instanceof Error ? error.message : "Failed to create role"
      );
      // console.error(error);
    }
  };

  const handleUpdateRole = async (roleId: string) => {
    if (!editingRole) return;

    try {
      const response = await apiFetch(`/api/role`, {
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

      CustomToast.success(
        "Role updated successfully. Affected users will be logged out automatically."
      );
      fetchRoles();
      setIsEditing(false);
      setEditingRole(null);
    } catch (error) {
      CustomToast.error(
        error instanceof Error ? error.message : "Failed to update role"
      );
      // console.error(error);
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

  // Helper function to get dependent permissions
  const getDependentPermissions = (
    resource: string,
    action: string
  ): string[] => {
    const dependencies: string[] = [];

    // READ is required for all other actions
    if (action !== Action.READ) {
      dependencies.push(Action.READ);
    }

    // Resource-specific dependencies
    switch (resource) {
      case Resource.CUSTOMER:
        // For customer operations, READ is essential for APPROVE, REJECT, UPDATE, DELETE
        if (
          [
            Action.APPROVE,
            Action.REJECT,
            Action.UPDATE,
            Action.DELETE,
          ].includes(action as Action)
        ) {
          dependencies.push(Action.READ);
        }
        break;

      case Resource.WALLET:
        // For wallet operations, READ is essential for UPDATE, DELETE
        if ([Action.UPDATE, Action.DELETE].includes(action as Action)) {
          dependencies.push(Action.READ);
        }
        break;

      case Resource.MINT:
      case Resource.BURN:
      case Resource.FREEZE:
      case Resource.BLACKLIST:
      case Resource.REFUND:
        // For these operations, READ is essential for CREATE, APPROVE, REJECT
        if (
          [Action.CREATE, Action.APPROVE, Action.REJECT].includes(
            action as Action
          )
        ) {
          dependencies.push(Action.READ);
        }
        break;

      case Resource.CONFIG:
        // For config operations, READ is essential for UPDATE, CREATE
        if ([Action.UPDATE, Action.CREATE].includes(action as Action)) {
          dependencies.push(Action.READ);
        }
        break;
    }

    return [...new Set(dependencies)]; // Remove duplicates
  };

  // Helper function to get permissions that depend on the current action
  const getDependentOnPermissions = (
    resource: string,
    action: string
  ): string[] => {
    const dependents: string[] = [];

    // If removing READ, remove all other permissions for this resource
    if (action === Action.READ) {
      const resourceConfig = RESOURCE_PERMISSIONS.find(
        (r) => r.name === resource
      );
      if (resourceConfig) {
        dependents.push(
          ...resourceConfig.permissions.filter((p: string) => p !== Action.READ)
        );
      }
    }

    return dependents;
  };

  const handlePermissionChange = (
    resource: string,
    action: string,
    checked: boolean,
    isForEditing: boolean = false
  ) => {
    const updatePermissions = (prev: any) => {
      if (!prev) return null;

      const updatedPermissions = [...prev.permissions];
      const resourceIndex = updatedPermissions.findIndex(
        (p) => p.resource === resource
      );

      if (checked) {
        // Adding permission - check dependencies
        const dependencies = getDependentPermissions(resource, action);
        const actionsToAdd = [action, ...dependencies];

        if (resourceIndex === -1) {
          // Resource not found, add new resource with action and dependencies
          updatedPermissions.push({
            resource,
            actions: [...new Set(actionsToAdd)],
          });
        } else {
          // Resource found, add action and dependencies
          const existingActions = updatedPermissions[resourceIndex].actions;
          const newActions = [
            ...new Set([...existingActions, ...actionsToAdd]),
          ];
          updatedPermissions[resourceIndex] = {
            ...updatedPermissions[resourceIndex],
            actions: newActions,
          };
        }
      } else {
        // Removing permission - check dependents
        if (resourceIndex !== -1) {
          const dependents = getDependentOnPermissions(resource, action);
          const actionsToRemove = [action, ...dependents];

          updatedPermissions[resourceIndex] = {
            ...updatedPermissions[resourceIndex],
            actions: updatedPermissions[resourceIndex].actions.filter(
              (a: string) => !actionsToRemove.includes(a)
            ),
          };
        }
      }

      return {
        ...prev,
        permissions: updatedPermissions,
      };
    };

    if (isForEditing && editingRole) {
      setEditingRole(updatePermissions);
    } else {
      setNewRole(updatePermissions);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;

    try {
      const response = await apiFetch(`/api/role?id=${roleId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete role");
      }

      CustomToast.success(
        "Role deleted successfully. Affected users will be logged out automatically."
      );
      fetchRoles();
    } catch (error) {
      CustomToast.error(
        error instanceof Error ? error.message : "Failed to delete role"
      );
      // console.error(error);
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
                <span className="label-text-alt text-xs">
                  {newRole.name.length}/256 characters (letters and spaces only)
                </span>
              </label>
              <input
                type="text"
                placeholder="Enter role name (letters and spaces only)"
                className="input input-bordered w-full"
                value={newRole.name}
                onChange={(e) => handleRoleNameChange(e.target.value)}
              />
              {newRole.name && !validateRoleName(newRole.name) && (
                <label className="label">
                  <span className="label-text-alt text-error text-xs">
                    Role name must contain only letters and spaces (max 256
                    characters)
                  </span>
                </label>
              )}
            </div>

            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Description</span>
                <span className="label-text-alt text-xs">
                  {newRole.description.length}/512 characters
                </span>
              </label>
              <textarea
                placeholder="Enter role description"
                className="textarea textarea-bordered w-full"
                value={newRole.description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
              />
              {newRole.description &&
                !validateDescription(newRole.description) && (
                  <label className="label">
                    <span className="label-text-alt text-error text-xs">
                      Description must be 512 characters or less
                    </span>
                  </label>
                )}
            </div>

            <div className="mb-4">
              <label className="label">
                <span className="label-text">Permissions</span>
              </label>
              <div className="alert alert-info mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span className="text-sm">
                  <strong>Permission Dependencies:</strong> READ permission is
                  automatically selected when you choose other actions, as it's
                  required for most operations. Unchecking READ will remove all
                  other permissions for that resource.
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {RESOURCE_PERMISSIONS.map((resource) => (
                  <div key={resource.name} className="card bg-base-200">
                    <div className="card-body p-4">
                      <h3 className="card-title text-sm mb-2">
                        {resource.name}
                      </h3>
                      <div className="space-y-2">
                        {resource.permissions.map((action) => {
                          const isChecked = isPermissionActive(
                            resource.name,
                            action
                          );
                          const isReadAction = action === Action.READ;
                          const hasOtherPermissions = resource.permissions
                            .filter((p) => p !== Action.READ)
                            .some((p) => isPermissionActive(resource.name, p));
                          const isAutoSelected =
                            isReadAction && hasOtherPermissions && isChecked;

                          return (
                            <label
                              key={action}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={isChecked}
                                onChange={(e) =>
                                  handlePermissionChange(
                                    resource.name,
                                    action,
                                    e.target.checked
                                  )
                                }
                              />
                              <span
                                className={`text-sm ${
                                  isAutoSelected ? "text-info font-medium" : ""
                                }`}
                              >
                                {action}
                                {/* {isAutoSelected && (
                                  <span className="text-xs text-info ml-1">
                                    (auto)
                                  </span>
                                )} */}
                              </span>
                            </label>
                          );
                        })}
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
                  setIsCreating(false);
                  setNewRole({ name: "", description: "", permissions: [] });
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateRole}
                disabled={
                  !newRole.name.trim() ||
                  !validateRoleName(newRole.name) ||
                  !validateDescription(newRole.description) ||
                  !newRole.permissions.some((p) => p.actions.length > 0)
                }
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
                <span className="label-text-alt text-xs">
                  {editingRole.name.length}/256 characters (letters and spaces
                  only)
                </span>
              </label>
              <input
                type="text"
                placeholder="Enter role name (letters and spaces only)"
                className="input input-bordered w-full"
                value={editingRole.name}
                onChange={(e) => handleRoleNameChange(e.target.value, true)}
              />
              {editingRole.name && !validateRoleName(editingRole.name) && (
                <label className="label">
                  <span className="label-text-alt text-error text-xs">
                    Role name must contain only letters and spaces (max 256
                    characters)
                  </span>
                </label>
              )}
            </div>

            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Description</span>
                <span className="label-text-alt text-xs">
                  {(editingRole.description || "").length}/512 characters
                </span>
              </label>
              <textarea
                placeholder="Enter role description"
                className="textarea textarea-bordered w-full"
                value={editingRole.description || ""}
                onChange={(e) => handleDescriptionChange(e.target.value, true)}
              />
              {editingRole.description &&
                !validateDescription(editingRole.description) && (
                  <label className="label">
                    <span className="label-text-alt text-error text-xs">
                      Description must be 512 characters or less
                    </span>
                  </label>
                )}
            </div>

            <div className="mb-4">
              <label className="label">
                <span className="label-text">Permissions</span>
              </label>
              <div className="alert alert-info mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span className="text-sm">
                  <strong>Permission Dependencies:</strong> READ permission is
                  automatically selected when you choose other actions, as it's
                  required for most operations. Unchecking READ will remove all
                  other permissions for that resource.
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {RESOURCE_PERMISSIONS.map((resource) => (
                  <div key={resource.name} className="card bg-base-200">
                    <div className="card-body p-4">
                      <h3 className="card-title text-sm mb-2">
                        {resource.name}
                      </h3>
                      <div className="space-y-2">
                        {resource.permissions.map((action) => {
                          const isChecked = isPermissionActive(
                            resource.name,
                            action,
                            true
                          );
                          const isReadAction = action === Action.READ;
                          const hasOtherPermissions = resource.permissions
                            .filter((p) => p !== Action.READ)
                            .some((p) =>
                              isPermissionActive(resource.name, p, true)
                            );
                          const isAutoSelected =
                            isReadAction && hasOtherPermissions && isChecked;

                          return (
                            <label
                              key={action}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={isChecked}
                                onChange={(e) =>
                                  handlePermissionChange(
                                    resource.name,
                                    action,
                                    e.target.checked,
                                    true
                                  )
                                }
                              />
                              <span
                                className={`text-sm ${
                                  isAutoSelected ? "text-info font-medium" : ""
                                }`}
                              >
                                {action}
                                {/* {isAutoSelected && (
                                  <span className="text-xs text-info ml-1">
                                    (auto)
                                  </span>
                                )} */}
                              </span>
                            </label>
                          );
                        })}
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
                disabled={
                  !editingRole.name.trim() ||
                  !validateRoleName(editingRole.name) ||
                  !validateDescription(editingRole.description || "") ||
                  !editingRole.permissions.some((p) => p.actions.length > 0)
                }
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
                <h2 className="card-title break-words">{role.name}</h2>
                <div className="flex gap-2 flex-shrink-0">
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
                <p className="text-sm text-base-content/70 break-words whitespace-pre-wrap">
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
                      <span className="font-medium break-words">
                        {resource}:
                      </span>{" "}
                      <span className="break-words">
                        {resourcePermissions.join(", ")}
                      </span>
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