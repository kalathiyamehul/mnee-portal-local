"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function Verify2FAPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        token,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid verification code");
      } else if (result?.url) {
        router.push(result.url);
      }
    } catch (error) {
      setError("An error occurred during verification");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100">
      <div className="max-w-md w-full space-y-8 p-6 bg-base-200 rounded-lg shadow-lg">
        <div>
          <h2 className="text-3xl font-bold text-center">
            Two-Factor Authentication
          </h2>
          <p className="mt-2 text-center text-base-content/70">
            Please enter the verification code from your authenticator app
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="token" className="sr-only">
              Verification Code
            </label>
            <input
              id="token"
              name="token"
              type="text"
              required
              className="input input-bordered w-full"
              placeholder="Enter 6-digit code"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-error text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            className={`btn btn-primary w-full ${isLoading ? "loading" : ""}`}
            disabled={isLoading}
          >
            Verify
          </button>
        </form>
      </div>
    </div>
  );
}
