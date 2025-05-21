import { NextResponse } from 'next/server';
import { generateCSRFToken } from '@/lib/csrf';

export async function GET() {
    const token = generateCSRFToken();
    const res = NextResponse.json({ csrfToken: token });
    res.cookies.set('csrfToken', token, {
        httpOnly: false,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });
    return res;
} 