import { TwitterApi } from "twitter-api-v2";

// Twitter API v2 clients with different permission levels
// These are initialized from environment variables

// Read-write client for posting tweets
export const twitterRW = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY || "",
  appSecret: process.env.TWITTER_API_SECRET || "",
  accessToken: process.env.TWITTER_ACCESS_TOKEN || "",
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || "",
});

// Read-only client using bearer token (app-only auth)
export const twitter = new TwitterApi(process.env.TWITTER_BEARER_TOKEN || "");

// Alias for backwards compatibility
export const twitterClient = twitter;

// User client (same as read-write for now)
export const twitterUserClient = twitterRW;
