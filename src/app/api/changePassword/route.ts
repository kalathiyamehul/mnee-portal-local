import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import bcrypt from 'bcrypt';
import { isPasswordValid } from '@/utils/auth';
import { withCSRF } from '@/lib/csrf';
import { createAPIRateLimit } from '@/lib/rateLimitHelpers';

export const POST = withCSRF(async function(request: Request) {
    const session = await getServerSession(authOptions);
    console.log('[Change Password] Session state:', {
        userId: session?.user?.id,
        userEmail: session?.user?.email
    });

    if (!session?.user?.id) {
        console.log('[Change Password] Error: No session or user ID found');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { currentPassword, newPassword } = await request.json();
        if (!currentPassword || !newPassword || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
            console.log('[Change Password] Error: Invalid request body');
            return NextResponse.json(
                { error: 'Current password and new password are required' },
                { status: 400 }
            );
        }
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { password: true }
        });
        if (!user) {
            console.log('[Change Password] Error: User not found');
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            console.log('[Change Password] Error: Current password is incorrect');
            return NextResponse.json(
                { error: 'Current password is incorrect' },
                { status: 400 }
            );
        }

        // Validate new password complexity
        const validation = isPasswordValid(newPassword);
        if (!validation.valid) {
            console.log('[Change Password] Error: New password validation failed -', validation.error);
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        // Check if new password is different from current
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            console.log('[Change Password] Error: New password must be different from current password');
            return NextResponse.json(
                { error: 'New password must be different from current password' },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update the user's password and set passwordChangedAt to invalidate existing sessions
        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                password: hashedPassword,
                passwordChangedAt: new Date() // This will invalidate all existing JWT tokens
            },
            select: { id: true, email: true }
        });

        console.log('[Change Password] Update successful:', {
            userId: updatedUser.id
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.log('[Change Password] Error during update:', error);
        return NextResponse.json(
            { error: 'Failed to change password' },
            { status: 500 }
        );
    }
}, createAPIRateLimit())