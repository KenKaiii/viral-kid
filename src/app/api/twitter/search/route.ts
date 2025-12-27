import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    // Get account credentials and config
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        twitterCredentials: true,
        twitterConfig: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!account.twitterCredentials?.rapidApiKey) {
      return NextResponse.json(
        { error: "RapidAPI key not configured" },
        { status: 400 }
      );
    }

    const searchTerm = account.twitterConfig?.searchTerm || "viral";
    const minimumLikesCount = account.twitterConfig?.minimumLikesCount ?? 20;
    const rapidApiKey = account.twitterCredentials.rapidApiKey;

    // Build filters
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    const filters = {
      since: today,
      minimumLikesCount,
      removePostsWithMedia: true,
      removeReplies: true,
      removePostsWithLinks: true,
      // Note: retweets are excluded by default (includeRetweets defaults to false)
    };

    // Call RapidAPI Twitter search
    const searchUrl = new URL(
      `https://twitter-aio.p.rapidapi.com/search/${encodeURIComponent(searchTerm)}`
    );
    searchUrl.searchParams.set("count", "20");
    searchUrl.searchParams.set("category", "Top");
    searchUrl.searchParams.set("filters", JSON.stringify(filters));

    // Fetch with timeout
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
      const errorText = await response.text();
      console.error("RapidAPI error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch from Twitter API" },
        { status: response.status }
      );
    }

    const data: RapidAPIResponse = await response.json();

    // Parse tweets from response
    const tweets: Array<{
      tweetId: string;
      userTweet: string;
      username: string;
      views: number;
      hearts: number;
      replies: number;
    }> = [];

    // Navigate through the nested structure
    const entries = data.entries?.[0]?.entries || [];

    for (const entry of entries) {
      // Only process tweet entries (not user modules or cursors)
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
      } catch (parseError) {
        console.error("Failed to parse tweet:", parseError);
        continue;
      }
    }

    // Save tweets to database using batch transaction
    let savedCount = 0;
    try {
      await db.$transaction(
        tweets.map((tweet) =>
          db.tweetInteraction.upsert({
            where: {
              accountId_tweetId: {
                accountId,
                tweetId: tweet.tweetId,
              },
            },
            update: {
              userTweet: tweet.userTweet,
              username: tweet.username,
              views: tweet.views,
              hearts: tweet.hearts,
              replies: tweet.replies,
            },
            create: {
              accountId,
              tweetId: tweet.tweetId,
              userTweet: tweet.userTweet,
              username: tweet.username,
              views: tweet.views,
              hearts: tweet.hearts,
              replies: tweet.replies,
            },
          })
        )
      );
      savedCount = tweets.length;
    } catch (dbError) {
      console.error("Failed to save tweets:", dbError);
    }

    // Log the search
    await db.log.create({
      data: {
        accountId,
        level: "success",
        message: `Searched for "${searchTerm}" - found ${tweets.length} tweets, saved ${savedCount}`,
      },
    });

    return NextResponse.json({
      success: true,
      searchTerm,
      found: tweets.length,
      saved: savedCount,
      tweets,
    });
  } catch (error) {
    console.error("Twitter search error:", error);
    return NextResponse.json(
      { error: "Failed to search Twitter" },
      { status: 500 }
    );
  }
}
