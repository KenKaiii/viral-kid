import { TwitterApi } from "twitter-api-v2";
import { env } from "./env";

// Read-only client (uses bearer token)
export const twitterClient = new TwitterApi(env.TWITTER_BEARER_TOKEN);

// Read-write client (uses OAuth 1.0a)
export const twitterUserClient = new TwitterApi({
  appKey: env.TWITTER_API_KEY,
  appSecret: env.TWITTER_API_SECRET,
  accessToken: env.TWITTER_ACCESS_TOKEN,
  accessSecret: env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Readonly v2 client
export const twitter = twitterClient.v2;

// Read-write v2 client
export const twitterRW = twitterUserClient.v2;
