'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { FaSync, FaSpinner } from 'react-icons/fa';
import { Suspense } from 'react';

function LoginPageInner() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams?.get('reset') === 'success' 
    ? 'Password reset successful. Please log in with your new password.'
    : '';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkUsers = useCallback(async () => {
    try {
      setChecking(true);
      const response = await fetch('/api/users/check');
      const data = await response.json();
      setHasUsers(data.hasUsers);
    } catch (err) {
      console.error('Error checking users:', err);
      // Default to true to avoid showing the no users message if we can't check
      setHasUsers(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkUsers();
  }, [checkUsers]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
        fromReset: success ? 'true' : 'false'
      });

      if (!res?.error) {
        router.push('/dash');
      } else if (res.error === 'PASSWORD_RESET_REQUIRED') {
        router.push('/reset-password');
      } else {
        setError('Invalid email or password');
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, router, success]);

  if (hasUsers === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-full max-w-sm p-6 bg-base-200 rounded-lg shadow-lg">
          <h1 className="text-2xl mb-4 text-center">No Users Found</h1>
          <p className="text-center text-base-content/70 mb-6">
            No users have been created yet. Please use the create-user script to create a user account.
          </p>
          <button 
            type="button"
            onClick={checkUsers}
            disabled={checking}
            className="btn btn-primary w-full"
          >
            {checking ? (
              <>
                <FaSync className="animate-spin mr-2" />
                Checking...
              </>
            ) : (
              <>
                <FaSync className="mr-2" />
                Check Again
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-full max-w-sm p-6 bg-base-200 rounded-lg shadow-lg">
        <h1 className="text-2xl mb-4 text-center">Login</h1>
        <form className="w-full" onSubmit={handleSubmit}>
          {success && <p className="text-success mb-4">{success}</p>}
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              className="input input-bordered w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="input input-bordered w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-error mb-4">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
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