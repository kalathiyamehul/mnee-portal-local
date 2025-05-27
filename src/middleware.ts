import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
	function middleware(req) {
		// Get the token from the request (it's already verified by withAuth)
		const token = req.nextauth.token;
		
		// Check if user needs to reset password
		const requiresReset = token?.requiresPasswordReset;
		const isResetPage = req.nextUrl.pathname === '/reset-password';
		const isResetApi = req.nextUrl.pathname === '/api/resetPassword';

		// Skip password reset check for the reset password API
		if (isResetApi) {
			return NextResponse.next();
		}

		// If requires reset and not on reset page, redirect to reset page
		if (requiresReset && !isResetPage) {
    //   console.log("[DEBUG] requiresReset", requiresReset);
			return NextResponse.redirect(new URL('/reset-password', req.url));
		}

		// If on reset page but doesn't require reset, redirect to home
		if (isResetPage && !requiresReset) {
			return NextResponse.redirect(new URL('/', req.url));
		}

		return NextResponse.next();
	},
	{
		callbacks: {
			authorized: ({ token }) => {
				if (!token) return false;
				try {
					const exp = (typeof token === 'object' && token.exp) ? token.exp : undefined;
					if (exp && typeof exp === 'number') {
						if (Date.now() >= exp * 1000) {
							return false;
						}
					}
					return true;
				} catch (e) {
					return false;
				}
			},
		},
	}
);

// Specify which routes require authentication
export const config = {
	matcher: [
		"/dash/:path*",
		"/reset-password",
		"/api/((?!auth|config|deploy|resetPassword|users/check).*)/:path*", // Protect all API routes except /api/auth/*, /api/config, /api/deploy, /api/resetPassword, and /api/users/check
	],
};
