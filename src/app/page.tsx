// app/page.tsx
import Home from "@/components/pages/Home";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";

export default async function HomePage() {
    const session = await getServerSession(authOptions);
  
    if (session) {
      redirect('/dash');
    }
  
    return <Home />;
  }
