// This should contain the existing role management code from:
// d:\Timechain Labs Projects\mnee-portal\src\app\(authenticated)\dash\super-admin\roles\page.tsx
// (Full implementation moved to components directory)
"use client";

import { Action, Resource } from "@/lib/permission";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

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


export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newRole, setNewRole] = useState({
    name: "",
    description: "",
    permissions: [] as PermissionGroup[],
  });
  const [editingRole, setEditingRole] = useState<Role | null>(null);

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
        body: JSON.stringify(newRole),
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
    try {
      const response = await fetch(`/api/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: roleId,
          name: editingRole?.name,
          description: editingRole?.description,
          permissions: editingRole?.rolePermissions.map((rp) => ({
            resource: rp.permission.resource,
            actions: [rp.permission.action],
          })),
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

  const handlePermissionChange = (
    resource: string,
    action: string,
    checked: boolean,
    isEditing: boolean = false
  ) => {
    const updateFunc = isEditing ? setEditingRole : setNewRole;
    const currentData = isEditing ? editingRole : newRole;

    if (!currentData) return;

    updateFunc((prev: any) => {
      const permissions = [...(prev.permissions || [])];
      const resourceGroup = permissions.find((p) => p.resource === resource);

      if (checked) {
        if (resourceGroup) {
          if (!resourceGroup.actions.includes(action)) {
            resourceGroup.actions.push(action);
          }
        } else {
          permissions.push({ resource, actions: [action] });
        }
      } else {
        if (resourceGroup) {
          resourceGroup.actions = resourceGroup.actions.filter(
            (a: string) => a !== action
          );
          if (resourceGroup.actions.length === 0) {
            return {
              ...prev,
              permissions: permissions.filter((p) => p.resource !== resource),
            };
          }
        }
      }

      return { ...prev, permissions };
    });
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
        <button 
          className="btn btn-primary"
          onClick={() => setIsCreating(true)}
        >
          Create New Role
        </button>
      </div>

      {/* Table Structure */}
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Role Name</th>
              <th>Description</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td className="font-medium">{role.name}</td>
                <td>{role.description || '-'}</td>
                <td>
                  {Object.values(Resource).map((resource) => {
                    const perms = role.rolePermissions
                      .filter(rp => rp.permission.resource === resource)
                      .map(rp => rp.permission.action);
                    
                    return perms.length > 0 ? (
                      <div key={resource} className="badge badge-outline badge-sm mr-2 mb-2">
                        {resource}: {perms.join(', ')}
                      </div>
                    ) : null;
                  })}
                </td>
                <td>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => {
                        setEditingRole(role);
                        setIsEditing(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => handleDeleteRole(role.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals (keep existing modal logic but update styling) */}
      {isCreating && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg mb-4">Create New Role</h3>
            {/* Keep existing form fields */}
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
                {Object.values(Resource).map((resource) => (
                  <div key={resource} className="card bg-base-200">
                    <div className="card-body p-4">
                      <h3 className="card-title text-sm mb-2">{resource}</h3>
                      <div className="space-y-2">
                        {Object.values(Action).map((action) => {
                          const isChecked =
                            newRole.permissions
                              .find((p) => p.resource === resource)
                              ?.actions.includes(action) ?? false;

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
                                    resource,
                                    action,
                                    e.target.checked
                                  )
                                }
                              />
                              <span className="text-sm">{action}</span>
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

      {isEditing && editingRole && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg mb-4">Edit Role</h3>
            {/* Keep existing edit form */}
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
                {Object.values(Resource).map((resource) => (
                  <div key={resource} className="card bg-base-200">
                    <div className="card-body p-4">
                      <h3 className="card-title text-sm mb-2">{resource}</h3>
                      <div className="space-y-2">
                        {Object.values(Action).map((action) => {
                          const isChecked = editingRole.rolePermissions.some(
                            (rp) =>
                              rp.permission.resource === resource &&
                              rp.permission.action === action
                          );

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
                                    resource,
                                    action,
                                    e.target.checked,
                                    true
                                  )
                                }
                              />
                              <span className="text-sm">{action}</span>
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
                disabled={!editingRole.name.trim()}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
