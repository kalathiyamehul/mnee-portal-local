"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FaSpinner } from "react-icons/fa6";
import { FiEye, FiEyeOff } from "react-icons/fi";
import {
  sanitizeHttpError,
  sanitizeError,
  getDisplayMessage,
} from "@/utils/errorHandler";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dash";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: email,
        password: password,
        ...(showTwoFactor && { token: token }),
        redirect: false,
      });
      if (result?.error === "2FA_REQUIRED") {
        setShowTwoFactor(true);
        setIsLoading(false);
        return;
      }

      if (result?.error) {
        if (result.error === "Invalid 2FA token") {
          setError("Invalid verification code");
          setToken("");
        } else if (result?.error.includes("Account locked")) {
          setError(result?.error);
        } else if (result?.error.includes("Rate limit exceeded")) {
          setError(result.error);
        } else if (
          result?.error.includes("Too many login attempts") ||
          result?.error.includes("Rate limit")
        ) {
          setError("Too many login attempts. Please try again later.");
        } else if (result?.error.includes("2FA attempts")) {
          setError("Too many 2FA attempts. Please try again later.");
        } else {
          setError("Invalid email or password");
        }
        setIsLoading(false);
        return;
      }

      if (result?.url) {
        router.push(result.url);
      }
    } catch (error) {
      const sanitizedError = sanitizeError(error, "Failed to login");
      setError(getDisplayMessage(sanitizedError));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100">
      <div className="max-w-md w-full space-y-8 p-6 bg-base-200 rounded-lg shadow-lg">
        <div>
          <h2 className="text-3xl font-bold text-center">
            {showTwoFactor
              ? "Enter Verification Code"
              : "Sign in to your account"}
          </h2>
          {showTwoFactor && (
            <p className="mt-2 text-center text-base-content/70">
              Please enter the verification code from your authenticator app
            </p>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {!showTwoFactor ? (
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input input-bordered w-full"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    className="input input-bordered w-full"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-4 top-3 z-50 text-gray-500"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <FiEyeOff size={18} className="text-gray-300" />
                    ) : (
                      <FiEye size={18} className="text-gray-300" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="token" className="sr-only">
                Verification Code
              </label>
              <input
                id="token"
                name="token"
                type="text"
                required
                maxLength={6}
                className="input input-bordered w-full text-center text-2xl tracking-wider"
                placeholder="000000"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
          )}

          {error && (
            <div className="text-error text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            className={`btn btn-primary w-full`}
            disabled={isLoading}
          >
            {showTwoFactor ? (
              "Verify"
            ) : isLoading ? (
              <>
                <FaSpinner className="animate-spin" />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </button>

          {showTwoFactor && (
            <button
              type="button"
              className="btn btn-ghost btn-sm w-full"
              onClick={() => {
                setShowTwoFactor(false);
                setToken("");
                setError("");
              }}
            >
              Back to Login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
