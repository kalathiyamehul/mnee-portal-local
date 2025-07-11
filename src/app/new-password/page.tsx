"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaSpinner } from "react-icons/fa6";
import { 
  sanitizeHttpError, 
  sanitizeError, 
  getDisplayMessage 
} from "@/utils/errorHandler";

// Password validation function (should match server-side)
function isPasswordValid(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', '111111', '123123',
    'password1', '1234', '12345', '12345678', 'iloveyou', 'admin', 'welcome',
    'monkey', 'login', 'letmein', 'football', 'baseball', 'starwars', 'dragon',
    'passw0rd', 'master', 'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1'
  ];
  if (commonPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'Password is too common. Please choose a more secure password.' };
  }
  return { valid: true };
}

export default function NewPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");

  useEffect(() => {
    // Check if user has a valid reset token
    const token = sessionStorage.getItem("resetToken");
    const userEmail = sessionStorage.getItem("resetEmail");
    
    if (!token || !userEmail) {
      router.push("/forgot-password");
      return;
    }
    
    setResetToken(token);
    setEmail(userEmail);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Validate passwords match
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match");
        setIsLoading(false);
        return;
      }

      // Validate password strength
      const validation = isPasswordValid(newPassword);
      if (!validation.valid) {
        setError(validation.error || "Password does not meet requirements");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/resetPasswordWithOtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          email, 
          resetToken, 
          newPassword 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password");
        setIsLoading(false);
        return;
      }

      // Clear session storage
      sessionStorage.removeItem("resetToken");
      sessionStorage.removeItem("resetEmail");

      // Redirect to login with success message
      router.push("/login?message=password-reset-success");

    } catch (error) {
      const sanitizedError = sanitizeError(error, "Failed to reset password");
      setError(getDisplayMessage(sanitizedError));
      setIsLoading(false);
    }
  };

  if (!email || !resetToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-primary mb-4 mx-auto" />
          <p>Checking authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100">
      <div className="max-w-md w-full space-y-8 p-6 bg-base-200 rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Set New Password</h2>
          <p className="mt-2 text-base-content/70">
            Create a strong password for your account
          </p>
          <p className="text-sm text-primary font-semibold">{email}</p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium mb-2">
              New Password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              className="input input-bordered w-full"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError("");
              }}
              disabled={isLoading}
              minLength={8}
            />
            {/* Real-time password validation */}
            {newPassword && !isPasswordValid(newPassword).valid && (
              <p className="text-error text-xs mt-1">
                {isPasswordValid(newPassword).error}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              className="input input-bordered w-full"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError("");
              }}
              disabled={isLoading}
              minLength={8}
            />
            {/* Real-time password match validation */}
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-error text-xs mt-1">
                Passwords do not match
              </p>
            )}
          </div>

          {error && (
            <div className="text-error text-sm text-center">{error}</div>
          )}

          <div className="bg-info/10 border border-info rounded-lg p-4">
            <h4 className="font-semibold text-info mb-2">Password Requirements:</h4>
            <ul className="text-sm space-y-1">
              <li>• At least 8 characters long</li>
              <li>• Contains uppercase letter (A-Z)</li>
              <li>• Contains lowercase letter (a-z)</li>
              <li>• Contains number (0-9)</li>
              <li>• Contains special character</li>
              <li>• Not a common password</li>
            </ul>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={
              isLoading || 
              !newPassword || 
              !confirmPassword || 
              newPassword !== confirmPassword ||
              !isPasswordValid(newPassword).valid
            }
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin" />
                Resetting Password...
              </>
            ) : (
              "Reset Password"
            )}
          </button>

          <div className="text-center">
            <a
              href="/login"
              className="link link-primary text-sm"
            >
              Back to Login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
} 