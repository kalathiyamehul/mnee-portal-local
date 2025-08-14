"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaSpinner } from "react-icons/fa6";
import { FiEye, FiEyeOff } from "react-icons/fi";

// Password validation function (should match server-side)
function isPasswordValid(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return {
      valid: false,
      error: "Password must be at least 8 characters long",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one uppercase letter",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one lowercase letter",
    };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one special character",
    };
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
    return {
      valid: false,
      error: "Password is too common. Please choose a more secure password.",
    };
  }
  return { valid: true };
}

// Helper function to check individual password requirements
function getPasswordRequirements(password: string) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    notCommon: !["password", "123456", "123456789", "qwerty", "abc123", "111111", "123123", "password1", "1234", "12345", "12345678", "iloveyou", "admin", "welcome", "monkey", "login", "letmein", "football", "baseball", "starwars", "dragon", "passw0rd", "master", "hello", "freedom", "whatever", "qazwsx", "trustno1"].includes(password.toLowerCase())
  };
}

type Step = "email" | "verify-otp" | "set-password" | "success";

function ForgotPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if this is a reset password flow
  const isResetFlow = searchParams.get("type") === "reset";
  const prefilledEmail = searchParams.get("email");
  const mode = isResetFlow ? "reset" : "forgot";

  const [currentStep, setCurrentStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);

  // Password visibility states
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Set prefilled email from URL parameter
  useEffect(() => {
    if (prefilledEmail) {
      setEmail(decodeURIComponent(prefilledEmail));
    }
  }, [prefilledEmail]);

  // Countdown timer for resend
  // useEffect(() => {
  //   let timer: NodeJS.Timeout;
  //   if (countdown > 0) {
  //     timer = setTimeout(() => setCountdown(countdown - 1), 1000);
  //   } else if (countdown === 0 && !canResend) {
  //     setCanResend(true);
  //   }
  //   return () => clearTimeout(timer);
  // }, [countdown, canResend]);

  const sendOtp = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/sendPasswordResetOtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          type: isResetFlow ? "reset" : "forgot",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentStep("verify-otp");
        setCountdown(120); // 2 minutes
        setCanResend(false);
      } else {
        setError(data.error || "Failed to send OTP");
      }
    } catch (err) {
      setError("Failed to send OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/resendPasswordResetOtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          type: isResetFlow ? "reset" : "forgot",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCountdown(120); // 2 minutes
        setCanResend(false);
        setError("");
      } else {
        setError(data.error || "Failed to resend OTP");
      }
    } catch (err) {
      setError("Failed to resend OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/verifyPasswordResetOtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          otp,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResetToken(data.resetToken);
        setCurrentStep("set-password");
      } else {
        setError(data.error || "Invalid OTP");
      }
    } catch (err) {
      setError("Failed to verify OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const setPassword = async () => {
    setIsLoading(true);
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    const validation = isPasswordValid(newPassword);
    if (!validation.valid) {
      setError(validation.error || "Password does not meet requirements");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/setPasswordWithOtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          resetToken,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentStep("success");
        // Auto-redirect after success
        setTimeout(() => {
          router.push("/login?message=password-reset-success");
        }, 3000);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch (err) {
      setError("Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTitle = () => {
    if (mode === "reset") {
      switch (currentStep) {
        case "email":
          return "Reset Password";
        case "verify-otp":
          return "Reset Password";
        case "set-password":
          return "Reset Password";
        case "success":
          return "Password Changed Successfully!";
        default:
          return "Reset Password";
      }
    } else {
      switch (currentStep) {
        case "email":
          return "Forgot Password";
        case "verify-otp":
          return "Verify Email";
        case "set-password":
          return "Set New Password";
        case "success":
          return "Password Changed Successfully!";
        default:
          return "Forgot Password";
      }
    }
  };

  const getSubtitle = () => {
    if (mode === "reset") {
      switch (currentStep) {
        case "email":
          return prefilledEmail
            ? `For security purposes, we need to verify your identity. We'll send a verification code to your email address.`
            : "Enter your email address and we'll send you a verification code to change your password.";
        case "verify-otp":
          return `We've sent a verification code to ${email}. Enter the code below to continue.`;
        case "set-password":
          return "Your email has been verified. Now set your new password.";
        case "success":
          return "Your password has been changed successfully. You can now log in with your new password.";
        default:
          return "";
      }
    } else {
      switch (currentStep) {
        case "email":
          return "Enter your email address and we'll send you a verification code to change your password.";
        case "verify-otp":
          return `We've sent a verification code to ${email}. Enter the code below to continue.`;
        case "set-password":
          return "Your email has been verified. Now set your new password.";
        case "success":
          return "Your password has been changed successfully. You can now log in with your new password.";
        default:
          return "";
      }
    }
  };

  // Get password requirements for live validation
  const passwordRequirements = getPasswordRequirements(newPassword);

  // Email step
  if (currentStep === "email") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-full max-w-md p-6 bg-base-200 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-4">{getTitle()}</h1>
          <p className="text-sm mb-6 text-center text-base-content/70">
            {getSubtitle()}
          </p>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          {prefilledEmail ? (
            // Show prefilled email as readonly for reset flow
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="p-3 bg-base-300 rounded border border-base-300">
                <p className="text-sm">
                  <strong>{email}</strong>
                </p>
                <p className="text-xs text-base-content/60 mt-1">
                  Email verified from your account
                </p>
              </div>
            </div>
          ) : (
            // Show editable email input for forgot flow
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="Enter your email address"
                disabled={isLoading}
                required
              />
            </div>
          )}

          <button
            onClick={sendOtp}
            className="btn btn-primary w-full"
            disabled={isLoading || !email}
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Sending Code...
              </>
            ) : (
              "Send Verification Code"
            )}
          </button>

          {!prefilledEmail && (
            <div className="text-center mt-4">
              <a href="/login" className="link link-ghost text-sm">
                Back to Login
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // OTP verification step
  if (currentStep === "verify-otp") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-full max-w-md p-6 bg-base-200 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-4">{getTitle()}</h1>
          <p className="text-sm mb-6 text-center text-base-content/70">
            {getSubtitle()}
          </p>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="otp" className="block text-sm font-medium mb-2">
              Verification Code
            </label>
            <input
              type="text"
              id="otp"
              className="input input-bordered w-full text-center text-2xl tracking-wider"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              placeholder="000000"
              maxLength={6}
              disabled={isLoading}
            />
          </div>

          <button
            onClick={verifyOtp}
            className="btn btn-primary w-full"
            disabled={isLoading || otp.length !== 6}
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              "Verify Code"
            )}
          </button>

          {/* Resend OTP */}
          <div className="text-center mt-4">
            {countdown > 0 ? (
              <p className="text-sm text-base-content/70">
                Resend code in {formatTime(countdown)}
              </p>
            ) : (
              <button
                onClick={resendOtp}
                className="link link-primary text-sm"
                disabled={isLoading || !canResend}
              >
                Resend Verification Code
              </button>
            )}
          </div>

          {/* Back to email - only show if email is not prefilled */}
          {!prefilledEmail && (
            <div className="text-center mt-2">
              <button
                onClick={() => {
                  setCurrentStep("email");
                  setOtp("");
                  setError("");
                  setCountdown(0);
                  setCanResend(true);
                }}
                className="link link-ghost text-sm"
                disabled={isLoading}
              >
                Back to {mode === "reset" ? "Previous Step" : "Email Entry"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Set password step
  if (currentStep === "set-password") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-full max-w-md p-6 bg-base-200 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-4">{getTitle()}</h1>
          <p className="text-sm mb-6 text-center text-base-content/70">
            {getSubtitle()}
          </p>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* New Password Input */}
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium mb-2"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  id="newPassword"
                  className="input input-bordered w-full pr-12"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter new password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 z-50 text-base-content/50 hover:text-base-content transition-colors"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={isLoading}
                >
                  {showNewPassword ? (
                    <FiEyeOff className="w-4 h-4" />
                  ) : (
                    <FiEye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {/* Real-time password validation */}
              {newPassword &&
                !isLoading &&
                !isPasswordValid(newPassword).valid && (
                  <p className="text-error text-xs mt-1">
                    {isPasswordValid(newPassword).error}
                  </p>
                )}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium mb-2"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  className="input input-bordered w-full pr-12"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 z-50 text-base-content/50 hover:text-base-content transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <FiEyeOff className="w-4 h-4" />
                  ) : (
                    <FiEye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {/* Password match validation */}
              {confirmPassword &&
                newPassword &&
                confirmPassword !== newPassword &&
                !isLoading && (
                  <p className="text-error text-xs mt-1">
                    Passwords do not match
                  </p>
                )}
            </div>
          </div>

          {/* Live Password Requirements Validation */}
          <div className="bg-info/10 border border-info rounded-lg p-4 mt-4">
            <h4 className="font-semibold text-info mb-2">
              Password Requirements:
            </h4>
            <ul className="text-sm space-y-1">
              <li
                className={`flex items-center ${
                  passwordRequirements.length
                    ? "text-success"
                    : "text-base-content/70"
                }`}
              >
                <span
                  className={`mr-2 ${passwordRequirements.length ? "✓" : "•"}`}
                >
                  {passwordRequirements.length ? "✓" : "•"}
                </span>
                At least 8 characters long
              </li>
              <li
                className={`flex items-center ${
                  passwordRequirements.uppercase
                    ? "text-success"
                    : "text-base-content/70"
                }`}
              >
                <span
                  className={`mr-2 ${
                    passwordRequirements.uppercase ? "✓" : "•"
                  }`}
                >
                  {passwordRequirements.uppercase ? "✓" : "•"}
                </span>
                Contains uppercase letter (A-Z)
              </li>
              <li
                className={`flex items-center ${
                  passwordRequirements.lowercase
                    ? "text-success"
                    : "text-base-content/70"
                }`}
              >
                <span
                  className={`mr-2 ${
                    passwordRequirements.lowercase ? "✓" : "•"
                  }`}
                >
                  {passwordRequirements.lowercase ? "✓" : "•"}
                </span>
                Contains lowercase letter (a-z)
              </li>
              <li
                className={`flex items-center ${
                  passwordRequirements.number
                    ? "text-success"
                    : "text-base-content/70"
                }`}
              >
                <span
                  className={`mr-2 ${passwordRequirements.number ? "✓" : "•"}`}
                >
                  {passwordRequirements.number ? "✓" : "•"}
                </span>
                Contains number (0-9)
              </li>
              <li
                className={`flex items-center ${
                  passwordRequirements.special
                    ? "text-success"
                    : "text-base-content/70"
                }`}
              >
                <span
                  className={`mr-2 ${passwordRequirements.special ? "✓" : "•"}`}
                >
                  {passwordRequirements.special ? "✓" : "•"}
                </span>
                Contains special character
              </li>
              <li
                className={`flex items-center ${
                  passwordRequirements.notCommon
                    ? "text-success"
                    : "text-base-content/70"
                }`}
              >
                <span
                  className={`mr-2 ${
                    passwordRequirements.notCommon ? "✓" : "•"
                  }`}
                >
                  {passwordRequirements.notCommon ? "✓" : "•"}
                </span>
                Not a common password
              </li>
            </ul>
          </div>

          <button
            onClick={setPassword}
            className="btn btn-primary w-full mt-6"
            disabled={isLoading || !newPassword || !confirmPassword}
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Setting Password...
              </>
            ) : (
              "Set New Password"
            )}
          </button>

          {/* Back to OTP */}
          <div className="text-center mt-4">
            <button
              onClick={() => {
                setCurrentStep("verify-otp");
                setNewPassword("");
                setConfirmPassword("");
                setShowNewPassword(false);
                setShowConfirmPassword(false);
                setError("");
              }}
              className="link link-ghost text-sm"
              disabled={isLoading}
            >
              Back to Verification
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success step
  if (currentStep === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-full max-w-md p-6 bg-base-200 rounded-lg shadow-lg text-center">
          <div className="mb-4">
            <svg
              className="w-16 h-16 mx-auto text-success"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4 text-success">{getTitle()}</h1>
          <p className="text-sm text-base-content/70 mb-4">{getSubtitle()}</p>
          <div className="loading loading-dots loading-md"></div>
        </div>
      </div>
    );
  }

  return null;
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ForgotPasswordInner />
    </Suspense>
  );
}