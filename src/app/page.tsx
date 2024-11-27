// app/page.tsx
import Home from "@/components/pages/Home";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getConfig } from "@/lib/config";

export default async function HomePage() {
	const config = await getConfig();

	if (!config?.token_id) {
		redirect("/setup");
	}

	const session = await getServerSession(authOptions);

	if (session) {
		redirect("/dash");
	}

	return <Home />;
}
