import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
	function middleware() {
		return NextResponse.next();
	},
	{
		callbacks: {
			authorized: ({ token }) => !!token,
		},
	},
);

// Specify which routes require authentication
export const config = {
	matcher: [
		"/dash/:path*",
		"/api/((?!auth|config).*)/:path*", // Protect all API routes except /api/auth/* and /api/config
	],
};
