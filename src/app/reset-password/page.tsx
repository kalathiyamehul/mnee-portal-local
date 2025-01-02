'use client';

import type React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      const res = await fetch('/api/resetPassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      if (res.ok) {
        // Sign out and redirect to login
        await signOut({ redirect: false });
        router.push('/login');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setError('Failed to reset password');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl mb-4">Reset Password</h1>
      <p className="text-sm mb-6 opacity-70">Your password needs to be reset before continuing.</p>
      <form className="w-full max-w-sm" onSubmit={handleSubmit}>
        {/* New Password Input */}
        <div className="mb-4">
          <label htmlFor="newPassword" className="block text-sm font-bold mb-2">
            New Password
          </label>
          <input
            type="password"
            id="newPassword"
            className="input input-bordered w-full max-w-sm"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {/* Confirm Password Input */}
        <div className="mb-6">
          <label htmlFor="confirmPassword" className="block text-sm font-bold mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            className="input input-bordered w-full max-w-sm"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {/* Error Message */}
        {error && <p className="text-red-500 mb-4">{error}</p>}
        {/* Submit Button */}
        <button type="submit" className="btn btn-primary w-full">
          Reset Password
        </button>
      </form>
    </div>
  );
} 