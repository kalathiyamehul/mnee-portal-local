"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { FaCircleInfo } from "react-icons/fa6";

export const ChangePassword = ({ onClose }: { onClose: () => void }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;
    setError("");

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
      const res = await fetch("/api/changePassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        toast.success("Password changed successfully");
        // Clear form
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onClose(); // Add this line to close the modal
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
          <input
            type="password"
            id="currentPassword"
            className="input input-bordered w-full"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={isSubmitting}
          />
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
          <input
            type="password"
            id="newPassword"
            className="input input-bordered w-full"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            disabled={isSubmitting}
          />
        </div>

        {/* Confirm New Password */}
        <div className="form-control w-full">
          <label className="label" htmlFor="confirmPassword">
            <span className="label-text font-medium">Confirm New Password</span>
            <div className="tooltip" data-tip="Re-enter your new password">
              <FaCircleInfo className="w-3 h-3 text-base-content/70" />
            </div>
          </label>
          <input
            type="password"
            id="confirmPassword"
            className="input input-bordered w-full"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={isSubmitting}
          />
        </div>

        {/* Error Message */}
        {error && <div className="text-error text-sm">{error}</div>}

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Changing Password..." : "Change Password"}
        </button>
      </form>
    </div>
  );
};
