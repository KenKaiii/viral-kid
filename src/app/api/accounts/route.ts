import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, getEffectiveUserId } from "@/lib/auth";

type TokenStatus = "healthy" | "expiring_soon" | "expired" | "not_connected";

function getTokenStatus(
  accessToken: string | null,
  tokenExpiresAt: Date | null
): { status: TokenStatus; expiresAt: Date | null } {
  if (!accessToken) {
    return { status: "not_connected", expiresAt: null };
  }

  if (!tokenExpiresAt) {
    // Has token but no expiration - assume healthy
    return { status: "healthy", expiresAt: null };
  }

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (tokenExpiresAt < now) {
    return { status: "expired", expiresAt: tokenExpiresAt };
  }

  if (tokenExpiresAt < sevenDaysFromNow) {
    return { status: "expiring_soon", expiresAt: tokenExpiresAt };
  }

  return { status: "healthy", expiresAt: tokenExpiresAt };
}

interface AccountWithCredentials {
  id: string;
  platform: string;
  name: string;
  order: number;
  twitterCredentials: {
    username: string | null;
    accessToken: string | null;
    tokenExpiresAt: Date | null;
    rapidApiKey: string | null;
  } | null;
  twitterConfig: {
    enabled: boolean;
    searchTerm: string | null;
  } | null;
  youtubeCredentials: {
    channelTitle: string | null;
    accessToken: string | null;
    tokenExpiresAt: Date | null;
  } | null;
  youtubeConfig: {
    enabled: boolean;
  } | null;
  instagramCredentials: {
    instagramUsername: string | null;
    accessToken: string | null;
    tokenExpiresAt: Date | null;
  } | null;
  redditCredentials: {
    username: string | null;
    accessToken: string | null;
    tokenExpiresAt: Date | null;
  } | null;
  redditConfig: {
    enabled: boolean;
    keywords: string | null;
  } | null;
  openRouterCredentials: {
    apiKey: string | null;
    selectedModel: string | null;
  } | null;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use effective user ID (handles admin impersonation)
    const effectiveUserId = getEffectiveUserId(session);
    if (!effectiveUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await db.account.findMany({
      where: { userId: effectiveUserId },
      orderBy: { order: "asc" },
      include: {
        twitterCredentials: {
          select: {
            username: true,
            accessToken: true,
            tokenExpiresAt: true,
            rapidApiKey: true,
          },
        },
        twitterConfig: {
          select: {
            enabled: true,
            searchTerm: true,
          },
        },
        youtubeCredentials: {
          select: {
            channelTitle: true,
            accessToken: true,
            tokenExpiresAt: true,
          },
        },
        youtubeConfig: {
          select: {
            enabled: true,
          },
        },
        instagramCredentials: {
          select: {
            instagramUsername: true,
            accessToken: true,
            tokenExpiresAt: true,
          },
        },
        redditCredentials: {
          select: {
            username: true,
            accessToken: true,
            tokenExpiresAt: true,
          },
        },
        redditConfig: {
          select: {
            enabled: true,
            keywords: true,
          },
        },
        openRouterCredentials: {
          select: {
            apiKey: true,
            selectedModel: true,
          },
        },
      },
    });

    // Transform to a simpler format for the frontend
    const formattedAccounts = accounts.map(
      (account: AccountWithCredentials) => {
        let isConnected = false;
        let displayName: string | null = null;
        let hasApiKey = false; // Platform-specific API (RapidAPI for Twitter)
        let hasSearchTerm = false; // Twitter-specific search term
        let isAutomationEnabled = false; // Whether scheduled automation is active
        let tokenHealth: { status: TokenStatus; expiresAt: Date | null } = {
          status: "not_connected",
          expiresAt: null,
        };

        if (account.platform === "twitter") {
          isConnected = !!account.twitterCredentials?.accessToken;
          displayName = account.twitterCredentials?.username
            ? `@${account.twitterCredentials.username}`
            : null;
          hasApiKey = !!account.twitterCredentials?.rapidApiKey;
          hasSearchTerm = !!account.twitterConfig?.searchTerm?.trim();
          isAutomationEnabled = account.twitterConfig?.enabled ?? false;
          tokenHealth = getTokenStatus(
            account.twitterCredentials?.accessToken ?? null,
            account.twitterCredentials?.tokenExpiresAt ?? null
          );
        } else if (account.platform === "youtube") {
          isConnected = !!account.youtubeCredentials?.accessToken;
          displayName = account.youtubeCredentials?.channelTitle || null;
          hasApiKey = true; // YouTube doesn't need extra API key for now
          hasSearchTerm = true; // YouTube doesn't need search term
          isAutomationEnabled = account.youtubeConfig?.enabled ?? false;
          tokenHealth = getTokenStatus(
            account.youtubeCredentials?.accessToken ?? null,
            account.youtubeCredentials?.tokenExpiresAt ?? null
          );
        } else if (account.platform === "instagram") {
          isConnected = !!account.instagramCredentials?.accessToken;
          displayName = account.instagramCredentials?.instagramUsername
            ? `@${account.instagramCredentials.instagramUsername}`
            : null;
          hasApiKey = true; // Instagram doesn't need extra API key for now
          hasSearchTerm = true; // Instagram doesn't need search term
          isAutomationEnabled = false; // TODO: Add when Instagram config has enabled field
          tokenHealth = getTokenStatus(
            account.instagramCredentials?.accessToken ?? null,
            account.instagramCredentials?.tokenExpiresAt ?? null
          );
        } else if (account.platform === "reddit") {
          isConnected = !!account.redditCredentials?.accessToken;
          displayName = account.redditCredentials?.username
            ? `u/${account.redditCredentials.username}`
            : null;
          hasApiKey = true; // Reddit doesn't need extra API key
          hasSearchTerm = !!account.redditConfig?.keywords?.trim(); // Keywords for search
          isAutomationEnabled = account.redditConfig?.enabled ?? false;
          tokenHealth = getTokenStatus(
            account.redditCredentials?.accessToken ?? null,
            account.redditCredentials?.tokenExpiresAt ?? null
          );
        }

        // OpenRouter credentials (shared across platforms)
        const hasOpenRouterKey = !!account.openRouterCredentials?.apiKey;
        const hasLlmModel = !!account.openRouterCredentials?.selectedModel;

        // Ready to run = all required credentials configured AND token not expired
        const isReady =
          isConnected &&
          tokenHealth.status !== "expired" &&
          hasApiKey &&
          hasSearchTerm &&
          hasOpenRouterKey &&
          hasLlmModel;

        return {
          id: account.id,
          platform: account.platform,
          name: account.name,
          order: account.order,
          isConnected,
          displayName,
          tokenStatus: tokenHealth.status,
          tokenExpiresAt: tokenHealth.expiresAt?.toISOString() ?? null,
          setup: {
            oauth: isConnected,
            apiKey: hasApiKey,
            searchTerm: hasSearchTerm,
            openRouter: hasOpenRouterKey,
            llmModel: hasLlmModel,
          },
          isReady,
          isAutomationEnabled,
        };
      }
    );

    return NextResponse.json(formattedAccounts);
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
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

    // Use effective user ID (handles admin impersonation)
    const effectiveUserId = getEffectiveUserId(session);
    if (!effectiveUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { platform } = body;

    if (
      !platform ||
      !["twitter", "youtube", "instagram", "reddit"].includes(platform)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid platform. Must be 'twitter', 'youtube', 'instagram', or 'reddit'",
        },
        { status: 400 }
      );
    }

    // Use transaction to prevent race conditions
    const MAX_ACCOUNTS_PER_PLATFORM = 3;

    const account = await db.$transaction(async (tx) => {
      // Check account limit per platform (max 3) - inside transaction for atomicity
      const existingCount = await tx.account.count({
        where: {
          userId: effectiveUserId,
          platform,
        },
      });

      if (existingCount >= MAX_ACCOUNTS_PER_PLATFORM) {
        throw new Error(
          `Maximum of ${MAX_ACCOUNTS_PER_PLATFORM} accounts per platform reached`
        );
      }

      // Get the highest order value for this user
      const lastAccount = await tx.account.findFirst({
        where: { userId: effectiveUserId },
        orderBy: { order: "desc" },
      });
      const newOrder = (lastAccount?.order ?? -1) + 1;

      // Create the account with its related credentials and config
      const platformData =
        platform === "twitter"
          ? {
              twitterCredentials: { create: {} },
              twitterConfig: { create: {} },
            }
          : platform === "youtube"
            ? {
                youtubeCredentials: { create: {} },
                youtubeConfig: { create: {} },
              }
            : platform === "instagram"
              ? {
                  instagramCredentials: { create: {} },
                  instagramConfig: { create: {} },
                }
              : {
                  redditCredentials: { create: {} },
                  redditConfig: { create: {} },
                };

      return tx.account.create({
        data: {
          platform,
          order: newOrder,
          userId: effectiveUserId,
          ...platformData,
        },
        include: {
          twitterCredentials: true,
          twitterConfig: true,
          youtubeCredentials: true,
          youtubeConfig: true,
          instagramCredentials: true,
          instagramConfig: true,
          redditCredentials: true,
          redditConfig: true,
        },
      });
    });

    return NextResponse.json({
      id: account.id,
      platform: account.platform,
      name: account.name,
      order: account.order,
      isConnected: false,
      displayName: null,
    });
  } catch (error) {
    // Check if this is a limit exceeded error from our transaction
    if (error instanceof Error && error.message.includes("Maximum of")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to create account:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
