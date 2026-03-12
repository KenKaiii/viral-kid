import { NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { db } from "@/lib/db";
import { auth, getEffectiveUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ParsedTweet {
  tweetId: string;
  userTweet: string;
  username: string;
  views: number;
  hearts: number;
  replies: number;
  imageUrls: string[];
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

  const expiresAt = credentials.tokenExpiresAt;
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt && expiresAt > fiveMinutesFromNow) {
    return credentials.accessToken;
  }

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

interface FetchResult {
  tweets: ParsedTweet[];
  debug: string;
}

async function fetchTweetsFromRapidAPI(
  rapidApiKey: string,
  searchTerm: string,
  minimumLikesCount: number,
  filterConfig: {
    removeReplies: boolean;
    removePostsWithLinks: boolean;
    removePostsWithMedia: boolean;
  }
): Promise<FetchResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const filters = {
    since,
    minimumLikesCount,
    removePostsWithMedia: filterConfig.removePostsWithMedia,
    removeReplies: filterConfig.removeReplies,
    removePostsWithLinks: filterConfig.removePostsWithLinks,
  };

  const searchUrl = new URL(
    `https://twitter-aio.p.rapidapi.com/search/${encodeURIComponent(searchTerm)}`
  );
  searchUrl.searchParams.set("count", "20");
  searchUrl.searchParams.set("category", "Latest");
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
    const body = await response.text().catch(() => "");
    throw new Error(`RapidAPI error ${response.status}: ${body.slice(0, 200)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();

  const topLevelKeys = Object.keys(data || {});
  if (!data?.entries) {
    return {
      tweets: [],
      debug: `API returned no entries field. Keys: [${topLevelKeys.join(", ")}]. Raw: ${JSON.stringify(data).slice(0, 300)}`,
    };
  }

  const entries = data.entries?.[0]?.entries || [];
  const debugParts: string[] = [
    `groups=${data.entries?.length ?? 0}`,
    `entries=${entries.length}`,
  ];

  let skippedNonTweet = 0;
  let skippedNoResult = 0;
  let skippedVideo = 0;
  let skippedParseError = 0;
  const tweets: ParsedTweet[] = [];

  for (const entry of entries) {
    if (!entry.entryId?.startsWith("tweet-")) {
      skippedNonTweet++;
      continue;
    }

    const result = entry.content?.itemContent?.tweet_results?.result;
    if (!result || result.__typename !== "Tweet") {
      skippedNoResult++;
      continue;
    }

    try {
      const media = result.legacy.extended_entities?.media || [];
      const hasVideo = media.some(
        (m: { type: string }) => m.type === "video" || m.type === "animated_gif"
      );
      if (hasVideo) {
        skippedVideo++;
        continue;
      }

      const imageUrls = media
        .filter((m: { type: string }) => m.type === "photo")
        .map((m: { media_url_https: string }) => m.media_url_https);

      tweets.push({
        tweetId: result.rest_id,
        userTweet: result.legacy.full_text,
        username: result.core.user_results.result.legacy.screen_name,
        views: parseInt(result.views?.count || "0", 10),
        hearts: result.legacy.favorite_count,
        replies: result.legacy.reply_count || 0,
        imageUrls,
      });
    } catch {
      skippedParseError++;
      continue;
    }
  }

  debugParts.push(
    `parsed=${tweets.length}`,
    `skipped: nonTweet=${skippedNonTweet} noResult=${skippedNoResult} video=${skippedVideo} parseErr=${skippedParseError}`
  );

  return { tweets, debug: debugParts.join(", ") };
}

const DEFAULT_RECREATE_PROMPT =
  "You are a social media content creator. Rewrite the following tweet in your own unique voice and style. Keep the same topic and key message but make it original. Do not copy the original text verbatim. Keep it under 280 characters. Output ONLY the tweet text.";

async function generateRecreatedText(
  apiKey: string,
  model: string,
  systemPrompt: string,
  originalText: string,
  styleOptions: {
    noHashtags: boolean;
    noEmojis: boolean;
    noCapitalization: boolean;
    badGrammar: boolean;
  }
): Promise<string> {
  const styleInstructions: string[] = [];
  if (styleOptions.noHashtags) styleInstructions.push("Do not use hashtags.");
  if (styleOptions.noEmojis) styleInstructions.push("Do not use emojis.");
  if (styleOptions.noCapitalization)
    styleInstructions.push("Use all lowercase letters.");
  if (styleOptions.badGrammar)
    styleInstructions.push("Use casual grammar with minor typos.");

  const fullSystemPrompt = [systemPrompt, ...styleInstructions]
    .filter(Boolean)
    .join(" ");

  const userMessage = `Rewrite this tweet:\n\n"${originalText}"`;

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
          { role: "user", content: userMessage },
        ],
        max_tokens: 8000,
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

  let reply = data.choices?.[0]?.message?.content?.trim();

  // Reasoning models may exhaust token budget on thinking — retry without reasoning
  if (!reply && data.choices?.[0]?.finish_reason === "length") {
    const retryResponse = await fetch(
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
            { role: "user", content: userMessage },
          ],
          max_tokens: 8000,
          temperature: 0.8,
        }),
      }
    );

    if (retryResponse.ok) {
      const retryData = await retryResponse.json();
      reply = retryData.choices?.[0]?.message?.content?.trim();
    }
  }

  if (!reply) {
    throw new Error(
      `Empty response from LLM. Response: ${JSON.stringify(data)}`
    );
  }

  return reply.slice(0, 280);
}

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
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

    // Auth: Check for cron secret (internal calls) or user session
    const cronSecret = request.headers.get("x-cron-secret");
    const isCronCall =
      cronSecret &&
      cronSecret === process.env.CRON_SECRET &&
      process.env.CRON_SECRET;

    let account;
    if (isCronCall) {
      account = await db.account.findUnique({
        where: { id: accountId },
        include: {
          twitterCredentials: true,
          twitterConfig: true,
          openRouterCredentials: true,
        },
      });
    } else {
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

    await createLog(accountId, "info", "Recreate pipeline started");

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

    let fetchResult: FetchResult;
    try {
      fetchResult = await fetchTweetsFromRapidAPI(
        twitterCredentials.rapidApiKey,
        searchTerm,
        minimumLikesCount,
        {
          removeReplies: twitterConfig?.removeReplies ?? true,
          removePostsWithLinks: twitterConfig?.removePostsWithLinks ?? false,
          removePostsWithMedia: twitterConfig?.removePostsWithMedia ?? false,
        }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch tweets";
      await createLog(accountId, "error", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    await createLog(
      accountId,
      "info",
      `RapidAPI response: ${fetchResult.debug}`
    );

    // Client-side filter as fallback
    const tweets = fetchResult.tweets.filter(
      (t) => t.hearts >= minimumLikesCount
    );

    if (tweets.length === 0) {
      await createLog(
        accountId,
        "warning",
        `No tweets found with at least ${minimumLikesCount} likes (pre-filter: ${fetchResult.tweets.length} tweets)`
      );
      return NextResponse.json({
        success: true,
        recreated: false,
        message: "No tweets found matching criteria",
      });
    }

    await createLog(
      accountId,
      "info",
      `Found ${tweets.length} tweets with ${minimumLikesCount}+ likes`
    );

    // Step 3: Filter out already-used tweets and tweets with no text
    const tweetIds = tweets.map((t) => t.tweetId);

    const existingRecreations = await db.recreatedTweet.findMany({
      where: {
        accountId,
        originalTweetId: { in: tweetIds },
      },
      select: { originalTweetId: true },
    });

    const recreatedIds = new Set(
      existingRecreations.map((r) => r.originalTweetId)
    );

    const availableTweets = tweets.filter(
      (t) => !recreatedIds.has(t.tweetId) && t.userTweet.trim().length > 0
    );

    if (availableTweets.length === 0) {
      await createLog(
        accountId,
        "warning",
        "All found tweets have already been recreated or have no text"
      );
      return NextResponse.json({
        success: true,
        recreated: false,
        message: "All found tweets have already been recreated",
      });
    }

    // Step 4: Sort by engagement (most likes, then fewest replies)
    availableTweets.sort((a, b) => {
      if (b.hearts !== a.hearts) return b.hearts - a.hearts;
      return a.replies - b.replies;
    });

    // Step 5: Loop through tweets until one succeeds
    const twitterClient = new TwitterApi(accessToken);

    // Create OAuth 1.0a client for media upload (v1.1 endpoint requires OAuth 1.0a)
    const hasOAuth1 =
      twitterCredentials.apiKey &&
      twitterCredentials.apiSecret &&
      twitterCredentials.accessTokenV1 &&
      twitterCredentials.accessSecretV1;
    const uploadClient = hasOAuth1
      ? new TwitterApi({
          appKey: twitterCredentials.apiKey,
          appSecret: twitterCredentials.apiSecret,
          accessToken: twitterCredentials.accessTokenV1,
          accessSecret: twitterCredentials.accessSecretV1,
        })
      : null;
    const recreatePrompt =
      twitterConfig?.recreateSystemPrompt || DEFAULT_RECREATE_PROMPT;

    for (const tweet of availableTweets) {
      const hasImages = tweet.imageUrls.length > 0;
      await createLog(
        accountId,
        "info",
        `Selected tweet by @${tweet.username} (${tweet.hearts} likes, ${tweet.replies} replies)${hasImages ? ` [${tweet.imageUrls.length} image(s)]` : ""}`
      );

      // Step 5a: Recreate text via LLM
      let recreatedText: string;
      try {
        recreatedText = await generateRecreatedText(
          openRouterCredentials.apiKey,
          openRouterCredentials.selectedModel,
          recreatePrompt,
          tweet.userTweet,
          {
            noHashtags: openRouterCredentials.noHashtags,
            noEmojis: openRouterCredentials.noEmojis,
            noCapitalization: openRouterCredentials.noCapitalization,
            badGrammar: openRouterCredentials.badGrammar,
          }
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to generate text";
        await createLog(accountId, "error", `LLM error: ${message}`);
        return NextResponse.json({ error: message }, { status: 500 });
      }

      await createLog(
        accountId,
        "info",
        `Recreated text: "${recreatedText.slice(0, 50)}..."`
      );

      // Step 5b: Handle images — download and upload to Twitter
      const uploadedMediaIds: string[] = [];
      if (hasImages) {
        if (!uploadClient) {
          await createLog(
            accountId,
            "warning",
            "OAuth 1.0a credentials not configured — skipping image upload"
          );
        } else {
          for (const imageUrl of tweet.imageUrls.slice(0, 4)) {
            try {
              const imageBuffer = await downloadImage(imageUrl);
              if (!imageBuffer) {
                await createLog(
                  accountId,
                  "warning",
                  `Failed to download image: ${imageUrl}`
                );
                continue;
              }

              const mediaId = await uploadClient.v1.uploadMedia(imageBuffer, {
                mimeType: "image/jpeg",
              });
              uploadedMediaIds.push(mediaId);
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Unknown error";
              await createLog(
                accountId,
                "warning",
                `Failed to upload image to Twitter: ${message}`
              );
            }
          }

          if (uploadedMediaIds.length > 0) {
            await createLog(
              accountId,
              "info",
              `Uploaded ${uploadedMediaIds.length} image(s) to Twitter`
            );
          }
        }
      }

      // Step 5c: Post the tweet
      let postedTweetId: string;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tweetPayload: any = { text: recreatedText };

        if (uploadedMediaIds.length > 0) {
          tweetPayload.media = {
            media_ids: uploadedMediaIds as
              | [string]
              | [string, string]
              | [string, string, string]
              | [string, string, string, string],
          };
        }

        const result = await twitterClient.v2.tweet(tweetPayload);
        postedTweetId = result.data.id;
      } catch (error: unknown) {
        const err = error as { code?: number; data?: unknown };
        let message = "Failed to post tweet";
        if (error && typeof error === "object") {
          const detail = err.data
            ? JSON.stringify(err.data).slice(0, 300)
            : (error as Error).message || "";
          message = `code=${err.code || "?"} ${detail}`;
        }
        await createLog(
          accountId,
          "warning",
          `Twitter API error, trying next tweet: ${message}`
        );
        continue;
      }

      await createLog(
        accountId,
        "success",
        `Posted recreated tweet (original by @${tweet.username})`
      );

      // Step 5e: Save to DB
      try {
        await db.recreatedTweet.create({
          data: {
            accountId,
            originalTweetId: tweet.tweetId,
            originalText: tweet.userTweet,
            originalUsername: tweet.username,
            originalImageUrls: JSON.stringify(tweet.imageUrls),
            recreatedText,
            recreatedTweetId: postedTweetId,
            mediaIds: JSON.stringify(uploadedMediaIds),
            postedAt: new Date(),
          },
        });
      } catch (dbError) {
        console.error("Failed to store recreated tweet:", dbError);
        await createLog(
          accountId,
          "warning",
          "Tweet posted but failed to record in database"
        );
      }

      // Step 5f: Return after first successful post
      return NextResponse.json({
        success: true,
        recreated: true,
        originalBy: tweet.username,
        originalTweetId: tweet.tweetId,
        recreatedTweetId: postedTweetId,
        recreatedText,
        mediaCount: uploadedMediaIds.length,
      });
    }

    // All tweets failed to post
    await createLog(accountId, "warning", "Could not post any recreated tweet");
    return NextResponse.json({
      success: true,
      recreated: false,
      message: "Failed to post any recreated tweet",
    });
  } catch (error) {
    console.error("Recreate pipeline error:", error);
    return NextResponse.json(
      { error: "Pipeline failed unexpectedly" },
      { status: 500 }
    );
  }
}
