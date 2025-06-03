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
import { apiFetch } from "@/utils/api";
import { password } from "bun";
import { MdLockReset } from "react-icons/md";

interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role?: {
    id: string;
    name: string;
  } | null;
  createdBy: string;
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
  const [isResetting, setIsResetting] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 6,
    totalPages: 1,
  });

  // Add validation states
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
  });

  // Validation functions
  const validateName = (name: string) => {
    if (name.length < 2) return "Name must be at least 2 characters long";
    if (name.length > 512) return "Name must be less than 512 characters";
    // Unicode letters, marks, spaces, hyphens, apostrophes
    if (!/^[\p{L}\p{M}\s'_’-]+$/u.test(name))
      return "Name can only contain letters, spaces, hyphens, underscores and apostrophes";
    return "";
  };

  const validateEmail = (email: string) => {
    // Allow Unicode letters, numbers, ., _, and - before @
    if (!/^[\p{L}\p{N}._-]+@[a-zA-Z0-9.]+\.[a-zA-Z]{2,}$/u.test(email))
      return "Please enter a valid email address";
    if (email.length > 255) return "Email is too long";
    return "";
  };

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number' ;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Password must contain at least one special character' ;
    }
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', '111111', '123123',
      'password1', '1234', '12345', '12345678', 'iloveyou', 'admin', 'welcome',
      'monkey', 'login', 'letmein', 'football', 'baseball', 'starwars', 'dragon',
      'passw0rd', 'master', 'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1'
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
      return 'Password is too common. Please choose a more secure password.' ;
    }
    return;
  }

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
      const response = await apiFetch(
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
      const response = await apiFetch("/api/role");
      if (!response.ok) throw new Error("Failed to fetch roles");
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      toast.error("Failed to fetch roles");
      console.error(error);
    }
  };

  const handleCreateUser = async () => {
    // Validate all fields before submission
    const nameError = validateName(newUser.name);
    const emailError = validateEmail(newUser.email);
    const passwordError = validatePassword(newUser.password);

    // Update the error state setting to handle string returns
    setErrors({
      name: nameError,
      email: emailError,
      password: passwordError || "",
    });

    // Improved error feedback
    if (nameError || emailError || passwordError) {
      const firstError = [nameError, emailError, passwordError].find((e) => e);
      toast.error(firstError || "Please fix the form errors");
      return;
    }
    try {
      const response = await apiFetch("/api/users", {
        method: "POST",
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

    // Validate all fields before submission
    const nameError = validateName(editingUser.name);
    const emailError = validateEmail(editingUser.email);

    // Update the error state setting to handle string returns
    setErrors({
      name: nameError,
      email: emailError,
      password: "",
    });

    // Improved error feedback
    if (nameError || emailError) {
      const firstError = [nameError, emailError].find((e) => e);
      toast.error(firstError || "Please fix the form errors");
      return;
    }

    try {
      const response = await apiFetch(`/api/users/${userId}`, {
        method: "PUT",
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

  const handleResetUserPassword = async (userId: string) => {
    if (!editingUser) return;

    // Validate all fields before submission
    const passwordError = validatePassword(editingUser.password);

    // Update the error state setting to handle string returns
    setErrors({
      name: "",
      email: "",
      password: passwordError || "",
    });

    // Improved error feedback
    if (passwordError) {
      const firstError = [passwordError].find((e) => e);
      toast.error(firstError || "Please fix the form errors");
      return;
    }

    try {
      const response = await apiFetch(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editingUser.name,
          email: editingUser.email,
          password: editingUser.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to Reset user password");
      }

      toast.success("User Password Reset successfully");
      fetchUsers();
      setIsEditing(false);
      setEditingUser(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update user Password"
      );
      console.error(error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const response = await apiFetch(`/api/users/${userId}`, {
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
                    className={`input input-bordered w-full max-w-md ${
                      errors.name ? "input-error" : ""
                    }`}
                    maxLength={513}
                    value={newUser.name}
                    onChange={(e) => {
                      setNewUser(prev => ({ ...prev, name: e.target.value }));
                      setErrors(prev => ({...prev, name: validateName(e.target.value)}));
                    }}
                    placeholder="Enter name"
                    required
                  />
                  {errors.name && (
                    <div className="label mt-1">
                      <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">
                        {errors.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-control w-full">
                  <label className="label label-text">Email</label>
                  <input
                    type="email"
                    className={`input input-bordered w-full max-w-md ${
                      errors.email ? "input-error" : ""
                    }`}
                    value={newUser.email}
                    maxLength={256}
                    onChange={(e) => {
                      setNewUser(prev => ({ ...prev, email: e.target.value }));
                      setErrors(prev => ({...prev, email: validateEmail(e.target.value)}));
                    }}
                    placeholder="Enter email"
                    required
                  />
                  {errors.email && (
                    <div className="label mt-1">
                      <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">
                        {errors.email}
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-control w-full">
                  <label className="label label-text">Password</label>
                  <input
                    type="password"
                    className={`input input-bordered w-full max-w-md ${
                      errors.password ? "input-error" : ""
                    }`}
                    value={newUser.password}
                    maxLength={100}
                    onChange={(e) => {
                      const newPassword = e.target.value;
                      setNewUser((prev) => ({
                        ...prev,
                        password: newPassword,
                      }))
                      
                      // Validate on every change
                      const error = newPassword.trim() === "" 
                        ? "" 
                        : validatePassword(newPassword);
                      setErrors(prev => ({...prev, password: error || ""}));
                    }}
                    placeholder="Set password"
                    required
                  />
                  {errors.password && (
                    <div className="label mt-1">
                      <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">
                        {errors.password}
                      </span>
                    </div>
                  )}
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
                  onClick={() => {
                    setIsCreating(false);
                    setNewUser({name:"",email:"",password:"",roleId:""})
                    setErrors({name: "", password: "", email: ""});
                  }}
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
                    !newUser.roleId || !!errors.name || !!errors.email || !!errors.password
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
                    className={`input input-bordered w-full max-w-md ${
                      errors.name ? "input-error" : ""
                    }`}
                    value={editingUser.name || ""}
                    maxLength={513}
                    onChange={(e) => {
                      setEditingUser((prev) =>
                        prev ? { ...prev, name: e.target.value } : null
                      );
                      setErrors(prev => ({...prev, name: validateName(e.target.value)}));
                    }}
                    placeholder="Enter name"
                    required
                  />
                  {errors.name && (
                    <div className="label mt-1">
                      <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">
                        {errors.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-control w-full">
                  <label className="label label-text">Email</label>
                  <input
                    type="email"
                    className={`input input-bordered w-full max-w-md ${
                      errors.email ? "input-error" : ""
                    }`}
                    value={editingUser.email || ""}
                    maxLength={256}
                    onChange={(e) =>{
                      setEditingUser((prev) =>
                        prev ? { ...prev, email: e.target.value } : null
                      );
                      setErrors(prev => ({...prev, email: validateEmail(e.target.value)}));
                    }}
                    placeholder="Enter email"
                    required
                  />
                  {errors.email && (
                    <div className="label mt-1">
                      <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">
                        {errors.email}
                      </span>
                    </div>
                  )}
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
                    setErrors({name: "", password: "", email: ""});
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    !editingUser.name?.trim() ||
                    !editingUser.email?.trim() ||
                    !!errors.name ||
                    !!errors.email ||
                    JSON.stringify(editingUser) === JSON.stringify(originalUser)
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

      {/* Reset Password Modal */}
      {isResetting && editingUser &&(
         <div className="modal modal-open">
         <div className="modal-box max-w-lg">
           <h3 className="text-lg font-bold mb-6">Reset User Password</h3>
           <form
             onSubmit={(e) => {
               e.preventDefault();
               handleResetUserPassword(editingUser.id);
             }}
           >
             <div className="space-y-6">
             <div className="form-control w-full">
                  <label className="label label-text">Reset Password</label>
                  <input
                    type="password"
                    className={`input input-bordered w-full max-w-md ${
                      errors.password ? "input-error" : ""
                    }`}
                    value={editingUser.password}
                    maxLength={100}
                    onChange={(e) => {
                      const newPassword = e.target.value;
                      setEditingUser(prev => prev ? {...prev, password: newPassword} : null);
                      
                      // Validate on every change
                      const error = newPassword.trim() === "" 
                        ? "" 
                        : validatePassword(newPassword);
                      setErrors(prev => ({...prev, password: error || ""}));
                    }}
                    placeholder="Set new password"
                    required
                  />
                  {errors.password && (
                    <div className="label mt-1">
                      <span className="label-text-alt text-error break-words whitespace-pre-line max-w-full">
                        {errors.password}
                      </span>
                    </div>
                  )}
                </div>
             </div>

             <div className="modal-action">
               <button
                 type="button"
                 className="btn btn-ghost"
                 onClick={() => {
                   setIsResetting(false);
                   setEditingUser(null);
                   setErrors({name: "", password: "", email: ""});
                 }}
               >
                 Cancel
               </button>
               <button
                 type="submit"
                 className="btn btn-primary"
                 disabled={
                   !editingUser.password?.trim() || !!errors.password
                 }
               >
                 Reset Password
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
              <th className="bg-base-100 w-auto">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="hover">
                <td>
                  <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-2">
                    <div className="avatar">
                      <div className="mask mask-squircle w-10 h-10">
                        <img
                          src={getGravatarUrl(user.createdBy)}
                          alt="User avatar"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">{user.createdBy}</div>
                      <div className="text-sm text-base-content/70">
                        {formatDistanceToNow(new Date(user.createdAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex gap-1">
                  <button
                      className="btn btn-ghost btn-xs gap-2"
                      onClick={() => {
                        setEditingUser(user);
                        setOriginalUser(user);
                        setIsResetting(true);
                      }}
                    >
                      <MdLockReset className="w-4 h-4" />
                      Reset Password
                    </button>
                    <button
                      className="btn btn-ghost btn-xs gap-2"
                      onClick={() => {
                        setEditingUser(user);
                        setOriginalUser(user);
                        setIsEditing(true);
                      }}
                    >
                      <FaEdit className="w-4 h-4" />
                      Edit
                    </button>
                    {user.email !== session?.user?.email && (
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        Delete
                      </button>
                    )}
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
