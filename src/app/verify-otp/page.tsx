"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FaSpinner } from "react-icons/fa6";
import { 
  sanitizeHttpError, 
  sanitizeError, 
  getDisplayMessage 
} from "@/utils/errorHandler";

function VerifyOtpPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(120); // 2 minutes countdown

  useEffect(() => {
    if (!email) {
      router.push("/forgot-password");
      return;
    }

    // Start countdown for resend OTP
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [email, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/verifyOtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid OTP");
        setIsLoading(false);
        return;
      }

      // Store reset token temporarily for password reset
      sessionStorage.setItem("resetToken", data.resetToken);
      sessionStorage.setItem("resetEmail", email);

      // Redirect to new password page
      router.push("/new-password");

    } catch (error) {
      const sanitizedError = sanitizeError(error, "Failed to verify OTP");
      setError(getDisplayMessage(sanitizedError));
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setIsResending(true);
    setError("");

    try {
      const response = await fetch("/api/resendOtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to resend OTP");
        setIsResending(false);
        return;
      }

      // Reset countdown and disable resend
      setCountdown(120);
      setCanResend(false);
      setIsResending(false);

      // Restart countdown
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (error) {
      const sanitizedError = sanitizeError(error, "Failed to resend OTP");
      setError(getDisplayMessage(sanitizedError));
      setIsResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100">
      <div className="max-w-md w-full space-y-8 p-6 bg-base-200 rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Enter Verification Code</h2>
          <p className="mt-2 text-base-content/70">
            We've sent a 6-digit verification code to
          </p>
          <p className="font-semibold text-primary">{email}</p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="otp" className="block text-sm font-medium mb-2">
              Verification Code
            </label>
            <input
              id="otp"
              name="otp"
              type="text"
              maxLength={6}
              required
              className="input input-bordered w-full text-center text-2xl tracking-wider"
              placeholder="000000"
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                setOtp(value);
                setError("");
              }}
              disabled={isLoading}
            />
            <p className="text-xs text-base-content/60 mt-1">
              Enter the 6-digit code sent to your email
            </p>
          </div>

          {error && (
            <div className="text-error text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isLoading || otp.length !== 6}
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Code"
            )}
          </button>

          <div className="text-center space-y-2">
            <p className="text-sm text-base-content/60">
              Didn't receive the code?
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={!canResend || isResending}
              className={`btn btn-ghost btn-sm ${
                canResend ? "btn-primary" : "btn-disabled"
              }`}
            >
              {isResending ? (
                <>
                  <FaSpinner className="animate-spin" />
                  Resending...
                </>
              ) : canResend ? (
                "Resend Code"
              ) : (
                `Resend in ${formatTime(countdown)}`
              )}
            </button>
          </div>

          <div className="text-center">
            <a
              href="/forgot-password"
              className="link link-primary text-sm"
            >
              Back to Forgot Password
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyOtpPageInner />
    </Suspense>
  );
} 