import { NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { db } from "@/lib/db";
import { auth, getEffectiveUserId } from "@/lib/auth";

interface TweetResult {
  __typename: string;
  rest_id: string;
  core: {
    user_results: {
      result: {
        legacy: {
          screen_name: string;
          name: string;
        };
      };
    };
  };
  views?: {
    count: string;
  };
  legacy: {
    full_text: string;
    favorite_count: number;
    reply_count: number;
    created_at: string;
  };
}

interface TimelineEntry {
  entryId: string;
  content: {
    itemContent?: {
      tweet_results?: {
        result?: TweetResult;
      };
    };
  };
}

interface RapidAPIResponse {
  entries: Array<{
    type: string;
    entries: TimelineEntry[];
  }>;
}

interface ParsedTweet {
  tweetId: string;
  userTweet: string;
  username: string;
  views: number;
  hearts: number;
  replies: number;
}

async function createLog(
  accountId: string,
  level: "info" | "warning" | "error" | "success",
  message: string
) {
  await db.log.create({
    data: { accountId, level, message },
  });
}

async function refreshTokenIfNeeded(
  credentials: {
    clientId: string;
    clientSecret: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
    accountId: string;
  },
  accountId: string
): Promise<string | null> {
  if (!credentials.accessToken || !credentials.refreshToken) {
    return null;
  }

  // Check if token expires within 5 minutes
  const expiresAt = credentials.tokenExpiresAt;
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt && expiresAt > fiveMinutesFromNow) {
    return credentials.accessToken;
  }

  // Refresh the token
  try {
    const client = new TwitterApi({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
    });

    const { accessToken, refreshToken, expiresIn } =
      await client.refreshOAuth2Token(credentials.refreshToken);

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    await db.twitterCredentials.update({
      where: { accountId },
      data: { accessToken, refreshToken, tokenExpiresAt },
    });

    return accessToken;
  } catch (error) {
    console.error("Failed to refresh token:", error);
    return null;
  }
}

async function fetchTweetsFromRapidAPI(
  rapidApiKey: string,
  searchTerm: string,
  minimumLikesCount: number
): Promise<ParsedTweet[]> {
  const today = new Date().toISOString().split("T")[0];
  const filters = {
    since: today,
    minimumLikesCount,
    removePostsWithMedia: true,
    removeReplies: true,
    removePostsWithLinks: true,
  };

  const searchUrl = new URL(
    `https://twitter-aio.p.rapidapi.com/search/${encodeURIComponent(searchTerm)}`
  );
  searchUrl.searchParams.set("count", "20");
  searchUrl.searchParams.set("category", "Top");
  searchUrl.searchParams.set("filters", JSON.stringify(filters));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(searchUrl.toString(), {
      method: "GET",
      headers: {
        "x-rapidapi-host": "twitter-aio.p.rapidapi.com",
        "x-rapidapi-key": rapidApiKey,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`RapidAPI error: ${response.status}`);
  }

  const data: RapidAPIResponse = await response.json();
  const tweets: ParsedTweet[] = [];
  const entries = data.entries?.[0]?.entries || [];

  for (const entry of entries) {
    if (!entry.entryId?.startsWith("tweet-")) continue;
    const result = entry.content?.itemContent?.tweet_results?.result;
    if (!result || result.__typename !== "Tweet") continue;

    try {
      tweets.push({
        tweetId: result.rest_id,
        userTweet: result.legacy.full_text,
        username: result.core.user_results.result.legacy.screen_name,
        views: parseInt(result.views?.count || "0", 10),
        hearts: result.legacy.favorite_count,
        replies: result.legacy.reply_count || 0,
      });
    } catch {
      continue;
    }
  }

  return tweets;
}

async function generateReplyWithLLM(
  apiKey: string,
  model: string,
  systemPrompt: string,
  tweetContent: string,
  username: string,
  styleOptions: {
    noHashtags: boolean;
    noEmojis: boolean;
    noCapitalization: boolean;
    badGrammar: boolean;
  }
): Promise<string> {
  // Build style instructions
  const styleInstructions: string[] = [];
  if (styleOptions.noHashtags) styleInstructions.push("Do not use hashtags.");
  if (styleOptions.noEmojis) styleInstructions.push("Do not use emojis.");
  if (styleOptions.noCapitalization)
    styleInstructions.push("Use all lowercase letters.");
  if (styleOptions.badGrammar)
    styleInstructions.push("Use casual grammar with minor typos.");

  const fullSystemPrompt = [
    systemPrompt,
    "Keep your reply under 280 characters.",
    ...styleInstructions,
    "IMPORTANT: Output ONLY the tweet reply text itself. Do not include any reasoning, analysis, thinking, explanations, or meta-commentary. Just the raw reply text.",
  ]
    .filter(Boolean)
    .join(" ");

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXTAUTH_URL || "https://viral-kid.app",
        "X-Title": "Viral Kid",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: fullSystemPrompt },
          {
            role: "user",
            content: `Write a reply to this tweet from @${username}:\n\n"${tweetContent}"`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.8,
        include_reasoning: true,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${error}`);
  }

  const data = await response.json();

  const message = data.choices?.[0]?.message;
  const reply = message?.content?.trim();

  if (!reply) {
    throw new Error(
      `Empty response from LLM. Response: ${JSON.stringify(data)}`
    );
  }

  // Ensure reply is under 280 chars
  return reply.slice(0, 280);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Check for cron secret (internal calls) or user session
    const cronSecret = request.headers.get("x-cron-secret");
    const isCronCall =
      cronSecret &&
      cronSecret === process.env.CRON_SECRET &&
      process.env.CRON_SECRET;

    let account;
    if (isCronCall) {
      // Cron job call - just get the account directly
      account = await db.account.findUnique({
        where: { id: accountId },
        include: {
          twitterCredentials: true,
          twitterConfig: true,
          openRouterCredentials: true,
        },
      });
    } else {
      // User call - verify session and ownership
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      account = await db.account.findFirst({
        where: { id: accountId, userId: getEffectiveUserId(session)! },
        include: {
          twitterCredentials: true,
          twitterConfig: true,
          openRouterCredentials: true,
        },
      });
    }

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const { twitterCredentials, twitterConfig, openRouterCredentials } =
      account;

    // Validate credentials
    if (!twitterCredentials?.rapidApiKey) {
      await createLog(accountId, "error", "RapidAPI key not configured");
      return NextResponse.json(
        { error: "RapidAPI key not configured" },
        { status: 400 }
      );
    }

    if (!twitterCredentials?.accessToken) {
      await createLog(accountId, "error", "Twitter OAuth not connected");
      return NextResponse.json(
        { error: "Twitter OAuth not connected" },
        { status: 400 }
      );
    }

    if (!openRouterCredentials?.apiKey) {
      await createLog(accountId, "error", "OpenRouter API key not configured");
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 400 }
      );
    }

    if (!openRouterCredentials?.selectedModel) {
      await createLog(accountId, "error", "No LLM model selected");
      return NextResponse.json(
        { error: "No LLM model selected" },
        { status: 400 }
      );
    }

    await createLog(accountId, "info", "Pipeline started");

    // Step 1: Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(
      {
        clientId: twitterCredentials.clientId,
        clientSecret: twitterCredentials.clientSecret,
        accessToken: twitterCredentials.accessToken,
        refreshToken: twitterCredentials.refreshToken,
        tokenExpiresAt: twitterCredentials.tokenExpiresAt,
        accountId,
      },
      accountId
    );

    if (!accessToken) {
      await createLog(accountId, "error", "Failed to get valid access token");
      return NextResponse.json(
        { error: "Twitter authentication failed" },
        { status: 401 }
      );
    }

    // Step 2: Fetch tweets from RapidAPI
    const searchTerm = twitterConfig?.searchTerm || "viral";
    const minimumLikesCount = twitterConfig?.minimumLikesCount ?? 20;

    await createLog(
      accountId,
      "info",
      `Searching for "${searchTerm}" with min ${minimumLikesCount} likes`
    );

    let tweets: ParsedTweet[];
    try {
      tweets = await fetchTweetsFromRapidAPI(
        twitterCredentials.rapidApiKey,
        searchTerm,
        minimumLikesCount
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch tweets";
      await createLog(accountId, "error", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (tweets.length === 0) {
      await createLog(
        accountId,
        "warning",
        "No tweets found matching criteria"
      );
      return NextResponse.json({
        success: true,
        replied: false,
        message: "No tweets found matching criteria",
      });
    }

    await createLog(accountId, "info", `Found ${tweets.length} tweets`);

    // Step 3: Store tweets temporarily and filter out already replied
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get existing interactions for this account
    const existingInteractions = await db.tweetInteraction.findMany({
      where: {
        accountId,
        tweetId: { in: tweets.map((t) => t.tweetId) },
      },
      select: { tweetId: true, ourReply: true },
    });

    const repliedTweetIds = new Set(
      existingInteractions.filter((i) => i.ourReply).map((i) => i.tweetId)
    );

    // Filter out already replied tweets
    const unrepliedTweets = tweets.filter(
      (t) => !repliedTweetIds.has(t.tweetId)
    );

    if (unrepliedTweets.length === 0) {
      await createLog(
        accountId,
        "warning",
        "All found tweets have been replied to"
      );
      return NextResponse.json({
        success: true,
        replied: false,
        message: "All found tweets have been replied to already",
      });
    }

    // Step 4: Pick best tweet (most likes, least replies)
    // Sort by hearts DESC, then by replies ASC
    unrepliedTweets.sort((a, b) => {
      if (b.hearts !== a.hearts) return b.hearts - a.hearts;
      return a.replies - b.replies;
    });

    const bestTweet = unrepliedTweets[0]!;

    await createLog(
      accountId,
      "info",
      `Selected tweet by @${bestTweet.username} (${bestTweet.hearts} likes, ${bestTweet.replies} replies)`
    );

    // Step 5: Generate LLM reply
    let generatedReply: string;
    try {
      generatedReply = await generateReplyWithLLM(
        openRouterCredentials.apiKey,
        openRouterCredentials.selectedModel,
        openRouterCredentials.systemPrompt || "",
        bestTweet.userTweet,
        bestTweet.username,
        {
          noHashtags: openRouterCredentials.noHashtags,
          noEmojis: openRouterCredentials.noEmojis,
          noCapitalization: openRouterCredentials.noCapitalization,
          badGrammar: openRouterCredentials.badGrammar,
        }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate reply";
      await createLog(accountId, "error", `LLM error: ${message}`);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    await createLog(
      accountId,
      "info",
      `Generated reply: "${generatedReply.slice(0, 50)}..."`
    );

    // Step 6: Post reply via Twitter API
    const twitterClient = new TwitterApi(accessToken);

    let replyId: string;
    try {
      const result = await twitterClient.v2.tweet({
        text: generatedReply,
        reply: { in_reply_to_tweet_id: bestTweet.tweetId },
      });
      replyId = result.data.id;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to post reply";
      await createLog(accountId, "error", `Twitter API error: ${message}`);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    await createLog(
      accountId,
      "success",
      `Posted reply to @${bestTweet.username}`
    );

    // Step 7: Store the interaction
    try {
      await db.tweetInteraction.upsert({
        where: {
          accountId_tweetId: { accountId, tweetId: bestTweet.tweetId },
        },
        update: {
          userTweet: bestTweet.userTweet,
          username: bestTweet.username,
          views: bestTweet.views,
          hearts: bestTweet.hearts,
          replies: bestTweet.replies,
          ourReply: generatedReply,
          ourReplyId: replyId,
          repliedAt: new Date(),
        },
        create: {
          accountId,
          tweetId: bestTweet.tweetId,
          userTweet: bestTweet.userTweet,
          username: bestTweet.username,
          views: bestTweet.views,
          hearts: bestTweet.hearts,
          replies: bestTweet.replies,
          ourReply: generatedReply,
          ourReplyId: replyId,
          repliedAt: new Date(),
        },
      });

      // Clean up old interactions (older than 24 hours without reply)
      await db.tweetInteraction.deleteMany({
        where: {
          accountId,
          ourReply: null,
          createdAt: { lt: twentyFourHoursAgo },
        },
      });
    } catch (dbError) {
      console.error("Failed to store interaction:", dbError);
      // Reply was posted successfully, just log the DB error
      await createLog(
        accountId,
        "warning",
        "Reply posted but failed to record in database"
      );
    }

    return NextResponse.json({
      success: true,
      replied: true,
      repliedTo: bestTweet.username,
      tweetId: bestTweet.tweetId,
      replyId,
      reply: generatedReply,
    });
  } catch (error) {
    console.error("Twitter pipeline error:", error);
    return NextResponse.json(
      { error: "Pipeline failed unexpectedly" },
      { status: 500 }
    );
  }
}
