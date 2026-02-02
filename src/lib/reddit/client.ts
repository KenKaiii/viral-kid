/**
 * Reddit API client utilities
 */

import type {
  RedditPost,
  RedditCredentialsForRefresh,
  RedditTokenResult,
  GenerateReplyOptions,
  SearchOptions,
} from "./types";

const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REDDIT_API_BASE = "https://oauth.reddit.com";
const USER_AGENT = "ViralKid/1.0.0";

/**
 * Refresh Reddit OAuth token if expired or about to expire
 */
export async function refreshTokenIfNeeded(
  credentials: RedditCredentialsForRefresh
): Promise<RedditTokenResult | null> {
  if (!credentials.accessToken || !credentials.refreshToken) {
    return null;
  }

  // Check if token expires within 5 minutes
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (
    credentials.tokenExpiresAt &&
    credentials.tokenExpiresAt > fiveMinutesFromNow
  ) {
    // Token is still valid
    return {
      accessToken: credentials.accessToken,
      expiresAt: credentials.tokenExpiresAt,
    };
  }

  // Refresh the token
  const basicAuth = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`
  ).toString("base64");

  const response = await fetch(REDDIT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Reddit token: ${error}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

/**
 * Search Reddit posts by keywords
 */
export async function searchPosts(
  accessToken: string,
  options: SearchOptions
): Promise<RedditPost[]> {
  const { keywords, timeRange, limit = 25 } = options;

  // Parse comma-separated keywords and join with OR for broader search
  const keywordList = keywords
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (keywordList.length === 0) {
    return [];
  }

  // Join keywords with OR for Reddit search
  const searchQuery = keywordList.join(" OR ");

  const searchParams = new URLSearchParams({
    q: searchQuery,
    sort: "relevance",
    t: timeRange, // hour, day, week, month
    limit: limit.toString(),
    type: "link", // Only posts, not comments
  });

  const response = await fetch(
    `${REDDIT_API_BASE}/search?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to search posts: ${response.status}`);
  }

  const data = await response.json();
  return data.data.children.map((child: { data: RedditPost }) => child.data);
}

/**
 * Post a comment on a Reddit post
 */
export async function postComment(
  accessToken: string,
  postFullname: string,
  text: string
): Promise<string> {
  const response = await fetch(`${REDDIT_API_BASE}/api/comment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      thing_id: postFullname,
      text: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post comment: ${errorText}`);
  }

  const data = await response.json();
  // Reddit returns the comment in a nested structure
  const commentData = data?.json?.data?.things?.[0]?.data;
  return commentData?.name || "unknown";
}

/**
 * Generate a reply using OpenRouter LLM
 */
export async function generateReply(
  options: GenerateReplyOptions
): Promise<string> {
  const {
    apiKey,
    model,
    systemPrompt,
    postTitle,
    postBody,
    postAuthor,
    subreddit,
    styleOptions,
  } = options;

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
    "IMPORTANT: Output ONLY the comment text itself. Do not include any reasoning, analysis, thinking, explanations, or meta-commentary. Just the raw comment text.",
  ]
    .filter(Boolean)
    .join(" ");

  // Build post content - include body if available
  let postContent = `Title: "${postTitle}"`;
  if (postBody && postBody.trim().length > 0) {
    // Truncate body to avoid token limits
    const truncatedBody =
      postBody.length > 500 ? postBody.slice(0, 500) + "..." : postBody;
    postContent += `\n\nPost content:\n${truncatedBody}`;
  }

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
            content: `Write a comment for this Reddit post in r/${subreddit} by u/${postAuthor}:\n\n${postContent}`,
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

  return reply.slice(0, 500);
}
