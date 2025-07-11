"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaSpinner } from "react-icons/fa6";
import { 
  sanitizeHttpError, 
  sanitizeError, 
  getDisplayMessage 
} from "@/utils/errorHandler";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/forgotPassword", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send OTP");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      // Redirect to OTP verification page after a short delay
      setTimeout(() => {
        router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
      }, 2000);

    } catch (error) {
      const sanitizedError = sanitizeError(error, "Failed to send OTP");
      setError(getDisplayMessage(sanitizedError));
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <div className="max-w-md w-full space-y-8 p-6 bg-base-200 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="text-success text-6xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-success">OTP Sent Successfully!</h2>
            <p className="mt-2 text-base-content/70">
              We've sent a verification code to your email address. 
              You'll be redirected to the verification page shortly.
            </p>
            <div className="mt-4">
              <button
                onClick={() => router.push(`/verify-otp?email=${encodeURIComponent(email)}`)}
                className="btn btn-primary btn-sm"
              >
                Continue to Verification
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100">
      <div className="max-w-md w-full space-y-8 p-6 bg-base-200 rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Forgot Password</h2>
          <p className="mt-2 text-base-content/70">
            Enter your email address and we'll send you a verification code to reset your password.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="input input-bordered w-full"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-error text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isLoading || !email}
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin" />
                Sending OTP...
              </>
            ) : (
              "Send Verification Code"
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