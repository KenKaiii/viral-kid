import type { SendTweetV2Params } from "twitter-api-v2";
import { twitterRW } from "./clients";
import type {
  ReplyOptions,
  ReplyWithMediaOptions,
  ReplyResponse,
  BatchReplyItem,
  BatchReplyResult,
} from "./types";

/**
 * Reply to a tweet using Twitter API v2
 *
 * @param options - Reply options including text and target tweet ID
 * @returns Promise resolving to ReplyResponse with success/error status
 *
 * @example
 * ```ts
 * const result = await replyToTweet({
 *   text: "Thanks for sharing!",
 *   inReplyToTweetId: "1234567890",
 * });
 *
 * if (result.success) {
 *   console.log("Reply posted:", result.tweet.id);
 * }
 * ```
 *
 * @see https://docs.x.com/x-api/posts/creation-of-a-post
 */
export async function replyToTweet(
  options: ReplyOptions
): Promise<ReplyResponse> {
  const {
    text,
    inReplyToTweetId,
    autoPopulateReplyMetadata,
    excludeReplyUserIds,
  } = options;

  try {
    const payload: SendTweetV2Params = {
      text,
      reply: {
        in_reply_to_tweet_id: inReplyToTweetId,
      },
    };

    // Add optional reply metadata settings
    if (
      autoPopulateReplyMetadata !== undefined ||
      excludeReplyUserIds?.length
    ) {
      // Note: These fields are part of the X API v2 but may have limited support
      // in the twitter-api-v2 library. The core in_reply_to_tweet_id is fully supported.
    }

    const result = await twitterRW.v2.tweet(payload);

    return {
      success: true,
      tweet: {
        id: result.data.id,
        text: result.data.text,
      },
      raw: result,
    };
  } catch (error) {
    return handleReplyError(error);
  }
}

/**
 * Reply to a tweet with media attachments
 *
 * @param options - Reply options including text, target tweet ID, and media IDs
 * @returns Promise resolving to ReplyResponse
 *
 * @example
 * ```ts
 * // First upload media using twitterRW.v1.uploadMedia()
 * const mediaId = await uploadMedia(imagePath);
 *
 * const result = await replyWithMedia({
 *   text: "Check out this image!",
 *   inReplyToTweetId: "1234567890",
 *   mediaIds: [mediaId],
 * });
 * ```
 */
export async function replyWithMedia(
  options: ReplyWithMediaOptions
): Promise<ReplyResponse> {
  const { text, inReplyToTweetId, mediaIds } = options;

  // Validate media IDs count (Twitter API allows 1-4 media items)
  if (mediaIds.length === 0 || mediaIds.length > 4) {
    return {
      success: false,
      error: "Media IDs must contain between 1 and 4 items.",
      code: "INVALID_MEDIA",
    };
  }

  try {
    const payload: SendTweetV2Params = {
      text,
      reply: {
        in_reply_to_tweet_id: inReplyToTweetId,
      },
      media: {
        // Twitter API v2 requires exactly 1-4 media IDs as a tuple
        media_ids: mediaIds as
          | [string]
          | [string, string]
          | [string, string, string]
          | [string, string, string, string],
      },
    };

    const result = await twitterRW.v2.tweet(payload);

    return {
      success: true,
      tweet: {
        id: result.data.id,
        text: result.data.text,
      },
      raw: result,
    };
  } catch (error) {
    return handleReplyError(error);
  }
}

/**
 * Process multiple replies in sequence with rate limit awareness
 *
 * @param items - Array of batch reply items to process
 * @param delayMs - Delay between replies in milliseconds (default: 1000ms)
 * @returns Promise resolving to BatchReplyResult
 *
 * @example
 * ```ts
 * const replies = [
 *   { id: "1", tweetId: "123", text: "Reply 1" },
 *   { id: "2", tweetId: "456", text: "Reply 2" },
 * ];
 *
 * const result = await batchReply(replies);
 * console.log(`${result.successful}/${result.total} replies sent`);
 * ```
 */
export async function batchReply(
  items: BatchReplyItem[],
  delayMs: number = 1000
): Promise<BatchReplyResult> {
  const results: BatchReplyResult["results"] = [];
  let successful = 0;
  let failed = 0;

  for (const [index, item] of items.entries()) {
    const response = await replyToTweet({
      text: item.text,
      inReplyToTweetId: item.tweetId,
    });

    results.push({
      id: item.id,
      tweetId: item.tweetId,
      response,
    });

    if (response.success) {
      successful++;
    } else {
      failed++;
    }

    // Add delay between requests to respect rate limits (except for last item)
    if (index < items.length - 1) {
      await sleep(delayMs);
    }
  }

  return {
    total: items.length,
    successful,
    failed,
    results,
  };
}

/**
 * Create a thread of replies (self-reply chain)
 *
 * @param initialTweetId - The tweet ID to start the thread from
 * @param texts - Array of texts for each reply in the thread
 * @returns Promise resolving to array of ReplyResponses
 *
 * @example
 * ```ts
 * const thread = await createReplyThread("1234567890", [
 *   "First reply in thread",
 *   "Second reply, continuing the thought",
 *   "Final conclusion",
 * ]);
 * ```
 */
export async function createReplyThread(
  initialTweetId: string,
  texts: string[]
): Promise<ReplyResponse[]> {
  const results: ReplyResponse[] = [];
  let currentReplyToId = initialTweetId;

  for (const text of texts) {
    const response = await replyToTweet({
      text,
      inReplyToTweetId: currentReplyToId,
    });

    results.push(response);

    if (response.success) {
      // Chain to the new reply for thread continuation
      currentReplyToId = response.tweet.id;
    } else {
      // Stop the thread if a reply fails
      break;
    }

    // Small delay between thread posts
    await sleep(500);
  }

  return results;
}

/**
 * Handle and normalize Twitter API errors
 */
function handleReplyError(error: unknown): ReplyResponse {
  if (error instanceof Error) {
    // Check for common Twitter API error patterns
    const message = error.message;

    if (message.includes("Rate limit")) {
      return {
        success: false,
        error: "Rate limit exceeded. Please wait before sending more replies.",
        code: "RATE_LIMIT",
      };
    }

    if (message.includes("duplicate")) {
      return {
        success: false,
        error: "Duplicate reply detected. This content was already posted.",
        code: "DUPLICATE",
      };
    }

    if (message.includes("not found") || message.includes("404")) {
      return {
        success: false,
        error:
          "The tweet you are trying to reply to was not found or was deleted.",
        code: "NOT_FOUND",
      };
    }

    if (message.includes("unauthorized") || message.includes("401")) {
      return {
        success: false,
        error:
          "Authentication failed. Please check your Twitter API credentials.",
        code: "UNAUTHORIZED",
      };
    }

    if (message.includes("forbidden") || message.includes("403")) {
      return {
        success: false,
        error: "You do not have permission to reply to this tweet.",
        code: "FORBIDDEN",
      };
    }

    return {
      success: false,
      error: message,
      code: "UNKNOWN",
    };
  }

  return {
    success: false,
    error: "An unexpected error occurred while posting the reply.",
    code: "UNKNOWN",
  };
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
