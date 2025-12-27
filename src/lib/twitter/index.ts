/**
 * Twitter API modules
 *
 * This module provides organized access to Twitter/X API functionality.
 *
 * @example
 * ```ts
 * import { replyToTweet, batchReply, createReplyThread } from "@/lib/twitter";
 *
 * // Simple reply
 * const result = await replyToTweet({
 *   text: "Great point!",
 *   inReplyToTweetId: "1234567890",
 * });
 *
 * // Batch replies
 * const batch = await batchReply([
 *   { id: "1", tweetId: "123", text: "Reply 1" },
 *   { id: "2", tweetId: "456", text: "Reply 2" },
 * ]);
 * ```
 */

// Re-export clients
export {
  twitter,
  twitterRW,
  twitterClient,
  twitterUserClient,
} from "./clients";

// Reply functionality
export {
  replyToTweet,
  replyWithMedia,
  batchReply,
  createReplyThread,
} from "./replies";

// Types
export type {
  ReplyOptions,
  ReplyWithMediaOptions,
  ReplyResult,
  ReplyError,
  ReplyResponse,
  BatchReplyItem,
  BatchReplyResult,
} from "./types";
