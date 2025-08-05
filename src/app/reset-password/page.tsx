'use client';

import { useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.email) {
      // Redirect to forgot-password with reset type parameter and prefilled email
      router.replace(
        `/forgot-password?type=reset&email=${encodeURIComponent(
          session.user.email
        )}`
      );
    } else {
      // If no session, just redirect to forgot-password with reset type
      router.replace("/forgot-password?type=reset");
    }
  }, [router, session]);

  // Show loading while redirecting
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-6 bg-base-200 rounded-lg shadow-lg text-center">
        <div className="loading loading-dots loading-md mb-4"></div>
        <p className="text-sm text-base-content/70">
          Redirecting to password reset...
        </p>
      </div>
    </div>
  );
}