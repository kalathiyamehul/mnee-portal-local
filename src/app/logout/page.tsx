'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
    const router = useRouter();

    useEffect(() => {
        const handleLogout = async () => {
            await signOut({ redirect: false });
            router.push('/login');
        };

        handleLogout();
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <h1 className="text-2xl mb-4">Signing out...</h1>
                <div className="loading loading-spinner loading-lg" />
            </div>
        </div>
    );
}
