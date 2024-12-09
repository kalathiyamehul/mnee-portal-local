// src/app/signup/page.tsx
'use client';
import type React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();
    const [error, setError] = useState('');

    const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                }),
            });

            if (res.ok) {
                router.push('/login');
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to sign up');
            }
        } catch (err) {
            console.error('Sign-up error:', err);
            setError('An unexpected error occurred');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-2xl mb-4">Sign Up</h1>
            <form className="w-full max-w-sm" onSubmit={handleSignUp}>
                <div className="mb-4">
                    <label className="block text-base-content text-sm font-bold mb-2" htmlFor="email">
                        Email
                    </label>
                    <input
                        className="input input-bordered w-full max-w-sm"
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="mb-6">
                    <label className="block text-base-content text-sm font-bold mb-2" htmlFor="password">
                        Password
                    </label>
                    <input
                        className="input input-bordered w-full max-w-sm"
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                <button className="btn btn-primary w-full" type="submit">
                    Sign Up
                </button>
            </form>
        </div>
    );
}