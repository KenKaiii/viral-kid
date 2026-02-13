import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, getEffectiveUserId } from "@/lib/auth";
import {
  refreshTokenIfNeeded,
  fetchChannelVideos,
  fetchVideoComments,
  postCommentReply,
  type YouTubeComment,
} from "@/lib/youtube/client";

async function createLog(
  accountId: string,
  level: "info" | "warning" | "error" | "success",
  message: string
) {
  await db.log.create({
    data: { accountId, level, message },
  });
}

async function generateReplyWithLLM(
  apiKey: string,
  model: string,
  systemPrompt: string,
  commentContent: string,
  authorName: string,
  videoTitle: string,
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
    "Keep your reply under 500 characters.",
    ...styleInstructions,
    "IMPORTANT: Output ONLY the reply text itself. Do not include any reasoning, analysis, thinking, explanations, or meta-commentary. Just the raw reply text.",
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
            content: `Write a reply to this YouTube comment from ${authorName} on your video "${videoTitle}":\n\n"${commentContent}"`,
          },
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
  const message = data.choices?.[0]?.message;
  let reply = message?.content?.trim();

  // Reasoning models may exhaust token budget on thinking (finish_reason: "length")
  // and return empty content. Retry once without reasoning support.
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
            {
              role: "user",
              content: `Write a reply to this YouTube comment from ${authorName} on your video "${videoTitle}":\n\n"${commentContent}"`,
            },
          ],
          max_tokens: 500,
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

  // Ensure reply is under 500 chars (YouTube comment limit is 10,000 but we keep it short)
  return reply.slice(0, 500);
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
          youtubeCredentials: true,
          youtubeConfig: true,
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
          youtubeCredentials: true,
          youtubeConfig: true,
          openRouterCredentials: true,
        },
      });
    }

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const { youtubeCredentials, youtubeConfig, openRouterCredentials } =
      account;

    // Validate credentials
    if (!youtubeCredentials?.accessToken) {
      await createLog(accountId, "error", "YouTube OAuth not connected");
      return NextResponse.json(
        { error: "YouTube OAuth not connected" },
        { status: 400 }
      );
    }

    if (!youtubeCredentials?.channelId) {
      await createLog(accountId, "error", "YouTube channel not linked");
      return NextResponse.json(
        { error: "YouTube channel not linked" },
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

    await createLog(accountId, "info", "YouTube pipeline started");

    // Step 1: Refresh token if needed
    const tokenResult = await refreshTokenIfNeeded({
      clientId: youtubeCredentials.clientId,
      clientSecret: youtubeCredentials.clientSecret,
      accessToken: youtubeCredentials.accessToken,
      refreshToken: youtubeCredentials.refreshToken,
      tokenExpiresAt: youtubeCredentials.tokenExpiresAt,
    });

    if (!tokenResult) {
      await createLog(accountId, "error", "Failed to get valid access token");
      return NextResponse.json(
        { error: "YouTube authentication failed" },
        { status: 401 }
      );
    }

    // Update tokens in database if refreshed
    if (tokenResult.accessToken !== youtubeCredentials.accessToken) {
      await db.youTubeCredentials.update({
        where: { accountId },
        data: {
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          tokenExpiresAt: tokenResult.expiresAt,
        },
      });
    }

    const accessToken = tokenResult.accessToken;

    // Step 2: Fetch videos from the channel
    let videos;
    try {
      videos = await fetchChannelVideos(accessToken, 5); // Check last 5 videos
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch videos";
      await createLog(accountId, "error", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (videos.length === 0) {
      await createLog(accountId, "warning", "No videos found on channel");
      return NextResponse.json({
        success: true,
        replied: false,
        message: "No videos found on channel",
      });
    }

    await createLog(accountId, "info", `Found ${videos.length} videos`);

    // Step 3: Fetch comments from all videos
    const allComments: YouTubeComment[] = [];
    const minimumLikesCount = youtubeConfig?.minimumLikesCount ?? 5;

    for (const video of videos) {
      try {
        const comments = await fetchVideoComments(
          accessToken,
          video.videoId,
          video.title
        );
        // Filter by minimum likes
        const filteredComments = comments.filter(
          (c) => c.likeCount >= minimumLikesCount
        );
        allComments.push(...filteredComments);
      } catch (error) {
        console.error(`Error fetching comments for ${video.videoId}:`, error);
        // Continue with other videos
      }
    }

    if (allComments.length === 0) {
      await createLog(
        accountId,
        "warning",
        `No comments found with at least ${minimumLikesCount} likes`
      );
      return NextResponse.json({
        success: true,
        replied: false,
        message: "No comments found matching criteria",
      });
    }

    await createLog(
      accountId,
      "info",
      `Found ${allComments.length} comments with ${minimumLikesCount}+ likes`
    );

    // Step 4: Filter out already replied comments from database
    // (Comments are already filtered to last 7 days, DB retains for 14 days)
    const existingInteractions = await db.youTubeCommentInteraction.findMany({
      where: {
        accountId,
        commentId: { in: allComments.map((c) => c.commentId) },
      },
      select: { commentId: true, ourReply: true },
    });

    const repliedCommentIds = new Set(
      existingInteractions.filter((i) => i.ourReply).map((i) => i.commentId)
    );

    // Filter out already replied comments
    const unrepliedComments = allComments.filter(
      (c) => !repliedCommentIds.has(c.commentId)
    );

    if (unrepliedComments.length === 0) {
      await createLog(
        accountId,
        "warning",
        "All found comments have been replied to"
      );
      return NextResponse.json({
        success: true,
        replied: false,
        message: "All found comments have been replied to already",
      });
    }

    // Step 6: Pick best comment (most likes)
    unrepliedComments.sort((a, b) => b.likeCount - a.likeCount);
    const bestComment = unrepliedComments[0]!;

    await createLog(
      accountId,
      "info",
      `Selected comment by ${bestComment.authorName} (${bestComment.likeCount} likes) on "${bestComment.videoTitle}"`
    );

    // Step 7: Generate LLM reply
    let generatedReply: string;
    try {
      generatedReply = await generateReplyWithLLM(
        openRouterCredentials.apiKey,
        openRouterCredentials.selectedModel,
        openRouterCredentials.systemPrompt || "",
        bestComment.userComment,
        bestComment.authorName,
        bestComment.videoTitle,
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

    // Step 8: Post reply via YouTube API
    let replyId: string;
    try {
      replyId = await postCommentReply(
        accessToken,
        bestComment.commentId,
        generatedReply
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to post reply";
      await createLog(accountId, "error", `YouTube API error: ${message}`);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    await createLog(
      accountId,
      "success",
      `Posted reply to ${bestComment.authorName}`
    );

    // Step 9: Store the interaction
    try {
      await db.youTubeCommentInteraction.upsert({
        where: {
          accountId_commentId: { accountId, commentId: bestComment.commentId },
        },
        update: {
          videoId: bestComment.videoId,
          videoTitle: bestComment.videoTitle,
          userComment: bestComment.userComment,
          authorName: bestComment.authorName,
          authorChannelId: bestComment.authorChannelId,
          likeCount: bestComment.likeCount,
          ourReply: generatedReply,
          ourReplyId: replyId,
          repliedAt: new Date(),
        },
        create: {
          accountId,
          commentId: bestComment.commentId,
          videoId: bestComment.videoId,
          videoTitle: bestComment.videoTitle,
          userComment: bestComment.userComment,
          authorName: bestComment.authorName,
          authorChannelId: bestComment.authorChannelId,
          likeCount: bestComment.likeCount,
          ourReply: generatedReply,
          ourReplyId: replyId,
          repliedAt: new Date(),
        },
      });

      // Clean up old interactions (older than 14 days)
      // Since we only fetch comments from last 7 days, 14-day retention ensures no duplicates
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      await db.youTubeCommentInteraction.deleteMany({
        where: {
          accountId,
          createdAt: { lt: fourteenDaysAgo },
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
      repliedTo: bestComment.authorName,
      commentId: bestComment.commentId,
      videoTitle: bestComment.videoTitle,
      replyId,
      reply: generatedReply,
    });
  } catch (error) {
    console.error("YouTube pipeline error:", error);
    return NextResponse.json(
      { error: "Pipeline failed unexpectedly" },
      { status: 500 }
    );
  }
}
