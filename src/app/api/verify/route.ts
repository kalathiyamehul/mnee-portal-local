import { NextResponse } from "next/server";
import speakeasy from "speakeasy";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { withCSRF } from "@/lib/csrf";

export const POST = withCSRF(async function(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token, secret, disable } = await request.json();

    // Handle 2FA disable request
    if (disable) {
      await prisma.user.update({
        where: { email: session.user.email },
        data: {
          twoFactorSecret: null,
          twoFactorEnabled: false,
        },
      });
      return NextResponse.json({ success: true });
    }

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { twoFactorSecret: true },
    });

    const secretToVerify = secret || user?.twoFactorSecret;

    if (!secretToVerify) {
      return NextResponse.json({ error: "2FA not set up" }, { status: 400 });
    }

    const verified = speakeasy.totp.verify({
      secret: secretToVerify,
      encoding: "base32",
      token,
    });

    if (!verified) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    if (secret) {
      await prisma.user.update({
        where: { email: session.user.email },
        data: {
          twoFactorSecret: secret,
          twoFactorEnabled: true,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("2FA verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
})
