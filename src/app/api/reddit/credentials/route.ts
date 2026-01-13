import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

type TokenStatus = "healthy" | "expiring_soon" | "expired" | "not_connected";

function getTokenStatus(
  accessToken: string | null,
  tokenExpiresAt: Date | null
): TokenStatus {
  if (!accessToken) return "not_connected";
  if (!tokenExpiresAt) return "healthy";

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (tokenExpiresAt < now) return "expired";
  if (tokenExpiresAt < sevenDaysFromNow) return "expiring_soon";
  return "healthy";
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db.account.findFirst({
      where: { id: accountId, userId: session.user.id },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const credentials = await db.redditCredentials.findUnique({
      where: { accountId },
    });

    if (!credentials) {
      return NextResponse.json(
        { error: "Credentials not found" },
        { status: 404 }
      );
    }

    const tokenStatus = getTokenStatus(
      credentials.accessToken,
      credentials.tokenExpiresAt
    );

    return NextResponse.json({
      id: credentials.id,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret ? "••••••••" : "",
      redditUsername: credentials.username,
      isConnected: !!credentials.accessToken,
      tokenStatus,
      tokenExpiresAt: credentials.tokenExpiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch Reddit credentials:", error);
    return NextResponse.json(
      { error: "Failed to fetch credentials" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db.account.findFirst({
      where: { id: accountId, userId: session.user.id },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const body = await request.json();
    const { clientId, clientSecret } = body;

    const updateData: Record<string, string> = {};

    if (clientId !== undefined) updateData.clientId = clientId;
    if (clientSecret && clientSecret !== "••••••••")
      updateData.clientSecret = clientSecret;

    const credentials = await db.redditCredentials.update({
      where: { accountId },
      data: updateData,
    });

    return NextResponse.json({
      id: credentials.id,
      clientId: credentials.clientId,
      redditUsername: credentials.username,
      isConnected: !!credentials.accessToken,
    });
  } catch (error) {
    console.error("Failed to save Reddit credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}
