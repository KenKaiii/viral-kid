import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: List all users (admin only)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            accounts: true,
          },
        },
        accounts: {
          select: {
            platform: true,
            twitterCredentials: {
              select: { accessToken: true },
            },
            youtubeCredentials: {
              select: { accessToken: true },
            },
            instagramCredentials: {
              select: { accessToken: true },
            },
            redditCredentials: {
              select: { accessToken: true },
            },
          },
        },
      },
    });

    // Transform to include connected platforms info
    const formattedUsers = users.map((user) => {
      const connectedPlatforms = user.accounts
        .filter((account) => {
          if (account.platform === "twitter")
            return !!account.twitterCredentials?.accessToken;
          if (account.platform === "youtube")
            return !!account.youtubeCredentials?.accessToken;
          if (account.platform === "instagram")
            return !!account.instagramCredentials?.accessToken;
          if (account.platform === "reddit")
            return !!account.redditCredentials?.accessToken;
          return false;
        })
        .map((a) => a.platform);

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        accountCount: user._count.accounts,
        connectedPlatforms: [...new Set(connectedPlatforms)], // Unique platforms
      };
    });

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
