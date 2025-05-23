"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useSession } from "next-auth/react";
import { usePermission } from "@/hooks/usePermission";
import { Resource, Action } from "@/lib/permission";
import { formatDistanceToNow } from "date-fns";
import { FaUserPlus, FaEdit } from "react-icons/fa";
import { getGravatarUrl } from "@/utils/gravatar";
import { Pagination } from "@/components/common/Pagination";

interface User {
  id: string;
  name: string;
  email: string;
  role?: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  creator?: {
    name: string | null;
    email: string;
  };
}

interface Role {
  id: string;
  name: string;
}

interface PaginatedResponse {
  users: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function UsersPage() {
  const { hasPermission } = usePermission();
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 6,
    totalPages: 1,
  });

  const canManageUsers = hasPermission(Resource.SUPER_ADMIN, Action.MANAGE);

  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-lg text-gray-500">
          You don't have permission to view this page.
        </p>
      </div>
    );
  }

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [pagination.page, pagination.limit]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(
        `/api/users?page=${pagination.page}&limit=${pagination.limit}`
      );
      if (!response.ok) throw new Error("Failed to fetch users");
      const data: PaginatedResponse = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      toast.error("Failed to fetch users");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch("/api/role");
      if (!response.ok) throw new Error("Failed to fetch roles");
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      toast.error("Failed to fetch roles");
      console.error(error);
    }
  };

  const handleCreateUser = async () => {
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }
      toast.success("User created successfully");
      fetchUsers();
      setIsCreating(false);
      setNewUser({ name: "", email: "", password: "", roleId: "" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create user"
      );
      console.error(error);
    }
  };

  const handleUpdateUser = async (userId: string) => {
    if (!editingUser) return;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingUser.name,
          email: editingUser.email,
          roleId: editingUser.role?.id || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update user");
      }

      toast.success("User updated successfully");
      fetchUsers();
      setIsEditing(false);
      setEditingUser(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update user"
      );
      console.error(error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete user"
      );
      console.error(error);
    }
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen animate-fade-in">
        <div className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Management</h1>
        <button
          className="btn btn-primary gap-2"
          onClick={() => setIsCreating(true)}
        >
          <FaUserPlus className="w-4 h-4" />
          Create New User
        </button>
      </div>

      {/* Create User Modal */}
      {isCreating && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="text-lg font-bold mb-6">Add New User</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateUser();
              }}
            >
              <div className="space-y-6">
                <div className="form-control w-full">
                  <label className="label label-text">Name</label>
                  <input
                    type="text"
                    className="input input-bordered w-full max-w-md"
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Enter name"
                    required
                  />
                </div>

                <div className="form-control w-full">
                  <label className="label label-text">Email</label>
                  <input
                    type="email"
                    className="input input-bordered w-full max-w-md"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="Enter email"
                    required
                  />
                </div>

                <div className="form-control w-full">
                  <label className="label label-text">Password</label>
                  <input
                    type="password"
                    className="input input-bordered w-full max-w-md"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    placeholder="Enter password"
                    required
                  />
                </div>

                <div className="form-control w-full">
                  <label className="label label-text">Role</label>
                  <select
                    className="select select-bordered w-full max-w-md"
                    value={newUser.roleId}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        roleId: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select a role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    !newUser.name.trim() ||
                    !newUser.email.trim() ||
                    !newUser.password.trim() ||
                    !newUser.roleId
                  }
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setIsCreating(false)}
          ></div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditing && editingUser && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="text-lg font-bold mb-6">Edit User</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateUser(editingUser.id);
              }}
            >
              <div className="space-y-6">
                <div className="form-control w-full">
                  <label className="label label-text">Name</label>
                  <input
                    type="text"
                    className="input input-bordered w-full max-w-md"
                    value={editingUser.name || ""}
                    onChange={(e) =>
                      setEditingUser((prev) =>
                        prev ? { ...prev, name: e.target.value } : null
                      )
                    }
                    placeholder="Enter name"
                    required
                  />
                </div>

                <div className="form-control w-full">
                  <label className="label label-text">Email</label>
                  <input
                    type="email"
                    className="input input-bordered w-full max-w-md"
                    value={editingUser.email || ""}
                    onChange={(e) =>
                      setEditingUser((prev) =>
                        prev ? { ...prev, email: e.target.value } : null
                      )
                    }
                    placeholder="Enter email"
                    required
                  />
                </div>

                <div className="form-control w-full">
                  <label className="label label-text">Role</label>
                  <select
                    className="select select-bordered w-full max-w-md"
                    value={editingUser.role?.id || ""}
                    onChange={(e) =>
                      setEditingUser((prev) =>
                        prev
                          ? {
                              ...prev,
                              role: e.target.value
                                ? {
                                    id: e.target.value,
                                    name:
                                      roles.find((r) => r.id === e.target.value)
                                        ?.name || "",
                                  }
                                : undefined,
                            }
                          : null
                      )
                    }
                  >
                    <option value="">No Role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingUser(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    !editingUser.name?.trim() || !editingUser.email?.trim()
                  }
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => {
              setIsEditing(false);
              setEditingUser(null);
            }}
          ></div>
        </div>
      )}

      {/* Users List */}
      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr className="text-base-content/70 text-sm border-b border-base-200">
              <th className="bg-base-100">User</th>
              <th className="bg-base-100">Role</th>
              <th className="bg-base-100">Created By</th>
              <th className="bg-base-100 w-[180px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="hover">
                <td>
                  <div className="flex items-center gap-3">
                    <div className="avatar">
                      <div className="mask mask-squircle w-10 h-10">
                        <img
                          src={getGravatarUrl(user.email)}
                          alt="User avatar"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">
                        {user.name || "Unnamed User"}
                      </div>
                      <div className="text-sm text-base-content/70">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="text-sm">
                    {user.role?.name || (
                      <span className="text-base-content/50 italic">
                        No Role
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="avatar">
                      <div className="mask mask-squircle w-10 h-10">
                        <img
                          src={getGravatarUrl(user.email)}
                          alt="User avatar"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">{user.email}</div>
                      <div className="text-sm text-base-content/70">
                        {formatDistanceToNow(new Date(user.createdAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-ghost btn-sm gap-2"
                      onClick={() => {
                        setEditingUser(user);
                        setIsEditing(true);
                      }}
                    >
                      <FaEdit className="w-4 h-4" />
                      Edit
                    </button>
                    {user.email !== session?.user?.email &&
                      <button
                        className="btn btn-ghost btn-sm text-error"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        Delete
                      </button>
                    }
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          itemsPerPage={pagination.limit}
          totalItems={pagination.total}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
