// app/page.tsx
import Home from "@/components/pages/Home";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getConfig } from "@/lib/config";
// import { prisma } from "@/lib/prisma";

export default async function HomePage() {
	const config = await getConfig();
	if (!config?.tokenId) {
		redirect("/setup");
	}

	/* Signup functionality temporarily disabled
	// Check if any users exist
	const userCount = await prisma.user.count();
	if (userCount === 0) {
		redirect("/signup");
	}
	*/

	const session = await getServerSession(authOptions);
	if (session) {
		redirect("/dash");
	}

	return <Home />;
}
