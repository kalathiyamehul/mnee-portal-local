'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams?.get('reset') === 'success' 
    ? 'Password reset successful. Please log in with your new password.'
    : '';

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    
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
    }
  }, [email, password, router, success]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl mb-4">Login</h1>
      <form className="w-full max-w-sm" onSubmit={handleSubmit}>
        {success && <p className="text-success mb-4">{success}</p>}
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-bold mb-2">
            Email
          </label>
          <input
            type="email"
            id="email"
            className="input input-bordered w-full max-w-sm"
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
            className="input input-bordered w-full max-w-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <button type="submit" className="btn btn-primary w-full">
          Sign In
        </button>
      </form>
    </div>
  );
} 