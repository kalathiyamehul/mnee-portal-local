// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { initializeEnv } from "@/env";
// import { prisma } from "@/lib/prisma";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

// Use prisma instance
// import { getSession } from "next-auth/react";

// Use prisma instance
// const session = await getSession();
// const email = session?.user?.email;
// if (email) {
//   const user = await prisma.user.findUnique({
//     where: { email },
//   });
// }