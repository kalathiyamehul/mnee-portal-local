import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
	function middleware() {
		// Add any custom middleware logic here if needed
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
		"/api/((?!auth|config|status).*)/:path*", // Protect all API routes except /api/auth/* and /api/config
	],
};
