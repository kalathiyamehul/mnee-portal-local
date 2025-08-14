"use client";

import CustomToast from "@/components/common/CustomToast";
import { apiFetch } from "@/utils/api";
import { useState } from "react";
import { FaCircleInfo } from "react-icons/fa6";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { IoClose } from "react-icons/io5";

export const ChangePassword = ({ onClose }: { onClose: () => void }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return "Password must contain at least one special character";
    }
    const commonPasswords = [
      "password",
      "123456",
      "123456789",
      "qwerty",
      "abc123",
      "111111",
      "123123",
      "password1",
      "1234",
      "12345",
      "12345678",
      "iloveyou",
      "admin",
      "welcome",
      "monkey",
      "login",
      "letmein",
      "football",
      "baseball",
      "starwars",
      "dragon",
      "passw0rd",
      "master",
      "hello",
      "freedom",
      "whatever",
      "qazwsx",
      "trustno1",
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
      return "Password is too common. Please choose a more secure password.";
    }
    return;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;
    setError("");

    // Validate Password
    const newPasswordError = validatePassword(newPassword);
    if (newPasswordError) {
      setError(newPasswordError);
      return;
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiFetch("/api/changePassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        CustomToast.success(
          "Password changed successfully. All sessions will be terminated for security."
        );
        // Clear form
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onClose(); // Close the modal after successful password change

        // Note: User will be automatically logged out via SSE event
      } else {
        const data = await res.json();
        setError(data.error || "Failed to change password");
      }
    } catch (err) {
      setError("Failed to change password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Change Password</h3>
        <button
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-square"
          aria-label="Close"
        >
          <IoClose className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div className="form-control w-full">
          <label className="label" htmlFor="currentPassword">
            <span className="label-text font-medium">Current Password</span>
            <div className="tooltip" data-tip="Enter your current password">
              <FaCircleInfo className="w-3 h-3 text-base-content/70" />
            </div>
          </label>
          <div className="relative">
            <input
              type={showPassword.currentPassword ? "text" : "password"}
              id="currentPassword"
              className="input input-bordered w-full"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() =>
                setShowPassword({
                  ...showPassword,
                  currentPassword: !showPassword.currentPassword,
                })
              }
              className="absolute right-5 top-3 z-50 text-gray-500"
              aria-label={
                showPassword.currentPassword ? "Hide password" : "Show password"
              }
            >
              {showPassword.currentPassword ? (
                <FiEyeOff size={18} className="text-gray-300" />
              ) : (
                <FiEye size={18} className="text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="form-control w-full">
          <label className="label" htmlFor="newPassword">
            <span className="label-text font-medium">New Password</span>
            <div
              className="tooltip"
              data-tip="Password must be at least 8 characters long"
            >
              <FaCircleInfo className="w-3 h-3 text-base-content/70" />
            </div>
          </label>
          <div className="relative">
            <input
              type={showPassword.newPassword ? "text" : "password"}
              id="newPassword"
              className="input input-bordered w-full"
              value={newPassword}
              onChange={(e) => {
                const newPasswordError = validatePassword(e.target.value);
                setNewPassword(e.target.value);
                setError(newPasswordError || '');
              }}
              required
              minLength={8}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() =>
                setShowPassword({
                  ...showPassword,
                  newPassword: !showPassword.newPassword,
                })
              }
              className="absolute right-5 top-3 z-50 text-gray-500"
              aria-label={
                showPassword.newPassword ? "Hide password" : "Show password"
              }
            >
              {showPassword.newPassword ? (
                <FiEyeOff size={18} className="text-gray-300" />
              ) : (
                <FiEye size={18} className="text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Confirm New Password */}
        <div className="form-control w-full">
          <label className="label" htmlFor="confirmPassword">
            <span className="label-text font-medium">Confirm New Password</span>
            <div className="tooltip" data-tip="Re-enter your new password">
              <FaCircleInfo className="w-3 h-3 text-base-content/70" />
            </div>
          </label>
          <div className="relative">
            <input
              type={showPassword.confirmPassword ? "text" : "password"}
              id="confirmPassword"
              className="input input-bordered w-full"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() =>
                setShowPassword({
                  ...showPassword,
                  confirmPassword: !showPassword.confirmPassword,
                })
              }
              className="absolute right-5 top-3 z-50 text-gray-500"
              aria-label={
                showPassword.confirmPassword ? "Hide password" : "Show password"
              }
            >
              {showPassword.confirmPassword ? (
                <FiEyeOff size={18} className="text-gray-300" />
              ) : (
                <FiEye size={18} className="text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && <div className="text-error text-sm">{error}</div>}

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={isSubmitting || !!error}
        >
          {isSubmitting ? "Changing Password..." : "Change Password"}
        </button>
      </form>
    </div>
  );
};
