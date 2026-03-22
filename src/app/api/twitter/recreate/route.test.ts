import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    account: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    log: {
      create: vi.fn(),
    },
    recreatedTweet: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    twitterCredentials: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  getEffectiveUserId: vi.fn(),
}));

// Mock twitter-api-v2
const mockTweet = vi.fn();

vi.mock("twitter-api-v2", () => {
  class MockTwitterApi {
    v2 = { tweet: mockTweet };
    refreshOAuth2Token = vi.fn().mockResolvedValue({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      expiresIn: 7200,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(_config: any) {
      // All instances share the same mock functions
    }
  }
  return { TwitterApi: MockTwitterApi };
});

// Mock global fetch for RapidAPI and OpenRouter calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { db } from "@/lib/db";
import { auth, getEffectiveUserId } from "@/lib/auth";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGetEffectiveUserId = getEffectiveUserId as unknown as ReturnType<
  typeof vi.fn
>;
const mockAccountFindFirst = db.account.findFirst as unknown as ReturnType<
  typeof vi.fn
>;
const mockAccountFindUnique = db.account.findUnique as unknown as ReturnType<
  typeof vi.fn
>;
const mockLogCreate = db.log.create as unknown as ReturnType<typeof vi.fn>;
const mockRecreatedTweetFindMany = db.recreatedTweet
  .findMany as unknown as ReturnType<typeof vi.fn>;
const mockRecreatedTweetCreate = db.recreatedTweet
  .create as unknown as ReturnType<typeof vi.fn>;

// --- Test Data Fixtures ---

const validCredentials = {
  clientId: "client-id",
  clientSecret: "client-secret",
  accessToken: "access-token",
  refreshToken: "refresh-token",
  tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
  accountId: "acc-1",
  rapidApiKey: "rapid-api-key",
  apiKey: "api-key-v1",
  apiSecret: "api-secret-v1",
  accessTokenV1: "access-token-v1",
  accessSecretV1: "access-secret-v1",
};

const validConfig = {
  searchTerm: "tech",
  minimumLikesCount: 50,
  removeReplies: true,
  removePostsWithLinks: false,
  removePostsWithMedia: false,
  recreateSystemPrompt: null,
  recreateEnabled: true,
  negativeKeywords: "",
};

const validOpenRouter = {
  apiKey: "openrouter-key",
  selectedModel: "openai/gpt-4o-mini",
  noHashtags: false,
  noEmojis: false,
  noCapitalization: false,
  badGrammar: false,
};

const fullAccount = {
  id: "acc-1",
  userId: "user-1",
  twitterCredentials: validCredentials,
  twitterConfig: validConfig,
  openRouterCredentials: validOpenRouter,
};

function makeRapidAPIResponse(
  tweets: Array<{
    id: string;
    text: string;
    username: string;
    likes: number;
    replies?: number;
    images?: string[];
    hasVideo?: boolean;
  }>
) {
  return {
    entries: [
      {
        entries: tweets.map((t) => ({
          entryId: `tweet-${t.id}`,
          content: {
            itemContent: {
              tweet_results: {
                result: {
                  __typename: "Tweet",
                  rest_id: t.id,
                  legacy: {
                    full_text: t.text,
                    favorite_count: t.likes,
                    reply_count: t.replies ?? 0,
                    extended_entities: t.images?.length
                      ? {
                          media: t.images.map((url) => ({
                            type: "photo",
                            media_url_https: url,
                          })),
                        }
                      : t.hasVideo
                        ? {
                            media: [
                              { type: "video", media_url_https: "video.mp4" },
                            ],
                          }
                        : undefined,
                  },
                  core: {
                    user_results: {
                      result: { legacy: { screen_name: t.username } },
                    },
                  },
                  views: { count: String(t.likes * 100) },
                },
              },
            },
          },
        })),
      },
    ],
  };
}

function makeOpenRouterResponse(text: string) {
  return {
    choices: [{ message: { content: text }, finish_reason: "stop" }],
  };
}

function createPostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/twitter/recreate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Tests ---

describe("Twitter Recreate API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogCreate.mockResolvedValue({});
    mockGetEffectiveUserId.mockReturnValue("user-1");
  });

  // --- Auth & Validation ---

  it("returns 400 when accountId is missing", async () => {
    const response = await POST(createPostRequest({}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "accountId is required" });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(401);
  });

  it("returns 404 when account not found", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(null);

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Account not found" });
  });

  it("returns 400 when RapidAPI key is not configured", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce({
      ...fullAccount,
      twitterCredentials: { ...validCredentials, rapidApiKey: null },
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "RapidAPI key not configured",
    });
  });

  it("returns 400 when Twitter OAuth is not connected", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce({
      ...fullAccount,
      twitterCredentials: { ...validCredentials, accessToken: null },
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Twitter OAuth not connected",
    });
  });

  it("returns 400 when OpenRouter API key is not configured", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce({
      ...fullAccount,
      openRouterCredentials: { ...validOpenRouter, apiKey: null },
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "OpenRouter API key not configured",
    });
  });

  it("returns 400 when no LLM model is selected", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce({
      ...fullAccount,
      openRouterCredentials: { ...validOpenRouter, selectedModel: null },
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No LLM model selected" });
  });

  // --- Cron secret auth ---

  it("allows cron secret auth and uses findUnique", async () => {
    mockAccountFindUnique.mockResolvedValueOnce(fullAccount);
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);
    mockRecreatedTweetCreate.mockResolvedValueOnce({});
    mockTweet.mockResolvedValueOnce({ data: { id: "posted-1" } });

    // RapidAPI fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          {
            id: "t1",
            text: "Great tech tweet",
            username: "techguy",
            likes: 100,
          },
        ]),
    });
    // OpenRouter fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("My recreated tweet about tech"),
    });

    const request = new Request("http://localhost/api/twitter/recreate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": "test-cron-secret",
      },
      body: JSON.stringify({ accountId: "acc-1" }),
    });

    // Set env for cron
    process.env.CRON_SECRET = "test-cron-secret";

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recreated).toBe(true);
    expect(mockAccountFindUnique).toHaveBeenCalled();
    expect(mockAccountFindFirst).not.toHaveBeenCalled();

    delete process.env.CRON_SECRET;
  });

  // --- Token refresh ---

  it("returns 401 when token refresh fails (no tokens)", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce({
      ...fullAccount,
      twitterCredentials: {
        ...validCredentials,
        accessToken: "expired",
        refreshToken: null,
      },
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Twitter authentication failed",
    });
  });

  // --- RapidAPI search ---

  it("returns error when RapidAPI search fails", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limit exceeded",
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("RapidAPI error 429");
  });

  it("returns success with recreated=false when no tweets found", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeRapidAPIResponse([]),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.recreated).toBe(false);
    expect(data.message).toBe("No tweets found matching criteria");
  });

  it("returns success with recreated=false when all tweets already recreated", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          { id: "t1", text: "Already used", username: "user", likes: 100 },
        ]),
    });

    mockRecreatedTweetFindMany.mockResolvedValueOnce([
      { originalTweetId: "t1" },
    ]);

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.recreated).toBe(false);
    expect(data.message).toBe("All found tweets have already been recreated");
  });

  it("filters out image-only tweets with no real text", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);

    // Tweet text is only a t.co URL (image-only post)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          {
            id: "t1",
            text: "https://t.co/abc123",
            username: "photoguy",
            likes: 500,
            images: ["https://pbs.twimg.com/media/photo.jpg"],
          },
        ]),
    });

    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    const data = await response.json();

    expect(data.recreated).toBe(false);
    expect(data.message).toBe("All found tweets have already been recreated");
  });

  it("filters tweets below minimum likes threshold", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);

    // All tweets below the 50-like threshold
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          { id: "t1", text: "Low engagement", username: "user", likes: 10 },
          { id: "t2", text: "Also low", username: "user2", likes: 30 },
        ]),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.recreated).toBe(false);
  });

  // --- Full successful pipeline ---

  it("completes full pipeline: search → LLM → post → save", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);
    mockRecreatedTweetCreate.mockResolvedValueOnce({});
    mockTweet.mockResolvedValueOnce({ data: { id: "posted-123" } });

    // RapidAPI
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          {
            id: "t1",
            text: "Amazing tech insight",
            username: "techguru",
            likes: 200,
            replies: 5,
          },
          {
            id: "t2",
            text: "Another tweet",
            username: "other",
            likes: 100,
            replies: 2,
          },
        ]),
    });

    // OpenRouter
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeOpenRouterResponse("my take on this amazing tech insight"),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.recreated).toBe(true);
    expect(data.originalBy).toBe("techguru");
    expect(data.originalTweetId).toBe("t1");
    expect(data.recreatedTweetId).toBe("posted-123");
    expect(data.recreatedText).toBe("my take on this amazing tech insight");
    expect(data.mediaCount).toBe(0);

    // Verify tweet was posted
    expect(mockTweet).toHaveBeenCalledWith({
      text: "my take on this amazing tech insight",
    });

    // Verify saved to DB
    expect(mockRecreatedTweetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "acc-1",
        originalTweetId: "t1",
        originalText: "Amazing tech insight",
        originalUsername: "techguru",
        recreatedText: "my take on this amazing tech insight",
        recreatedTweetId: "posted-123",
      }),
    });
  });

  // --- Engagement sorting ---

  it("selects the highest-engagement tweet first", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);
    mockRecreatedTweetCreate.mockResolvedValueOnce({});
    mockTweet.mockResolvedValueOnce({ data: { id: "posted-1" } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          { id: "low", text: "Low likes", username: "a", likes: 60 },
          { id: "high", text: "High likes", username: "b", likes: 500 },
          { id: "mid", text: "Mid likes", username: "c", likes: 150 },
        ]),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("recreated high"),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    const data = await response.json();

    expect(data.recreated).toBe(true);
    expect(data.originalBy).toBe("b");
    expect(data.originalTweetId).toBe("high");
  });

  // --- Negative keywords filtering ---

  it("filters out tweets containing a negative keyword", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce({
      ...fullAccount,
      twitterConfig: { ...validConfig, negativeKeywords: "politics" },
    });
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);
    mockRecreatedTweetCreate.mockResolvedValueOnce({});
    mockTweet.mockResolvedValueOnce({ data: { id: "posted-1" } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          {
            id: "t1",
            text: "Breaking politics news today",
            username: "newsbot",
            likes: 500,
          },
          {
            id: "t2",
            text: "Amazing tech breakthrough",
            username: "techguru",
            likes: 200,
          },
        ]),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("recreated tech tweet"),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    const data = await response.json();

    expect(data.recreated).toBe(true);
    expect(data.originalBy).toBe("techguru");
    expect(data.originalTweetId).toBe("t2");
  });

  it("filters with multiple negative keywords", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce({
      ...fullAccount,
      twitterConfig: { ...validConfig, negativeKeywords: "politics, spam" },
    });
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);
    mockRecreatedTweetCreate.mockResolvedValueOnce({});
    mockTweet.mockResolvedValueOnce({ data: { id: "posted-1" } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          {
            id: "t1",
            text: "Politics update",
            username: "news",
            likes: 500,
          },
          {
            id: "t2",
            text: "Buy this spam product",
            username: "spammer",
            likes: 300,
          },
          {
            id: "t3",
            text: "Cool tech stuff",
            username: "dev",
            likes: 100,
          },
        ]),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("recreated cool tech"),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    const data = await response.json();

    expect(data.recreated).toBe(true);
    expect(data.originalBy).toBe("dev");
  });

  it("matches negative keywords case-insensitively", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce({
      ...fullAccount,
      twitterConfig: { ...validConfig, negativeKeywords: "NSFW" },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          {
            id: "t1",
            text: "This is nsfw content",
            username: "user",
            likes: 100,
          },
        ]),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    const data = await response.json();

    expect(data.recreated).toBe(false);
    expect(data.message).toBe("No tweets found matching criteria");
  });

  it("does not filter when negativeKeywords is empty", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce({
      ...fullAccount,
      twitterConfig: { ...validConfig, negativeKeywords: "" },
    });
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);
    mockRecreatedTweetCreate.mockResolvedValueOnce({});
    mockTweet.mockResolvedValueOnce({ data: { id: "posted-1" } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          {
            id: "t1",
            text: "Politics and spam tweet",
            username: "user",
            likes: 100,
          },
        ]),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("recreated tweet"),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    const data = await response.json();

    expect(data.recreated).toBe(true);
    expect(data.originalBy).toBe("user");
  });

  // --- LLM error ---

  it("returns 500 when LLM call fails", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          { id: "t1", text: "Tweet text", username: "user", likes: 100 },
        ]),
    });

    // OpenRouter fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "Internal Server Error",
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("OpenRouter error");
  });

  // --- Twitter post failure → tries next tweet ---

  it("tries next tweet when Twitter API rejects the first post", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);
    mockRecreatedTweetCreate.mockResolvedValueOnce({});

    // First tweet post fails, second succeeds
    mockTweet
      .mockRejectedValueOnce({ code: 403, data: { detail: "Duplicate" } })
      .mockResolvedValueOnce({ data: { id: "posted-2" } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          { id: "t1", text: "First tweet", username: "a", likes: 200 },
          { id: "t2", text: "Second tweet", username: "b", likes: 100 },
        ]),
    });

    // Two LLM calls (one per tweet attempt)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("recreated first"),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("recreated second"),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    const data = await response.json();

    expect(data.recreated).toBe(true);
    expect(data.originalBy).toBe("b");
    expect(data.recreatedTweetId).toBe("posted-2");
    expect(mockTweet).toHaveBeenCalledTimes(2);
  });

  it("returns recreated=false when all tweet posts fail", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);

    mockTweet.mockRejectedValue({ code: 403, data: { detail: "Forbidden" } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          { id: "t1", text: "Tweet one", username: "a", likes: 100 },
        ]),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("recreated one"),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    const data = await response.json();

    expect(data.recreated).toBe(false);
    expect(data.message).toBe("Failed to post any recreated tweet");
  });

  // --- Image handling ---

  it("downloads and uploads images with the tweet", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);
    mockRecreatedTweetCreate.mockResolvedValueOnce({});
    mockTweet.mockResolvedValueOnce({ data: { id: "posted-img" } });

    // RapidAPI with images
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          {
            id: "t1",
            text: "Tweet with pic",
            username: "photographer",
            likes: 100,
            images: ["https://pbs.twimg.com/media/photo1.jpg"],
          },
        ]),
    });

    // OpenRouter
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("my photo tweet"),
    });

    // Image download
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
      headers: new Headers({ "content-type": "image/png" }),
    });

    // X API v2 media upload
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "media-id-1" } }),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    const data = await response.json();

    expect(data.recreated).toBe(true);
    expect(data.mediaCount).toBe(1);
    expect(mockTweet).toHaveBeenCalledWith({
      text: "my photo tweet",
      media: { media_ids: ["media-id-1"] },
    });
  });

  // --- entities.media fallback ---

  it("picks up images from entities.media when extended_entities is missing", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);
    mockRecreatedTweetCreate.mockResolvedValueOnce({});
    mockTweet.mockResolvedValueOnce({ data: { id: "posted-fallback" } });

    // Custom RapidAPI response with entities.media but no extended_entities
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        entries: [
          {
            entries: [
              {
                entryId: "tweet-fb1",
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        __typename: "Tweet",
                        rest_id: "fb1",
                        legacy: {
                          full_text: "Single image tweet",
                          favorite_count: 200,
                          reply_count: 0,
                          entities: {
                            media: [
                              {
                                type: "photo",
                                media_url_https:
                                  "https://pbs.twimg.com/media/fallback.jpg",
                              },
                            ],
                          },
                        },
                        core: {
                          user_results: {
                            result: {
                              legacy: { screen_name: "singleimg" },
                            },
                          },
                        },
                        views: { count: "20000" },
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
      }),
    });

    // OpenRouter
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("fallback image tweet"),
    });

    // Image download
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(50),
      headers: new Headers({ "content-type": "image/jpeg" }),
    });

    // X API v2 media upload
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "media-fallback-1" } }),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    const data = await response.json();

    expect(data.recreated).toBe(true);
    expect(data.mediaCount).toBe(1);
    expect(data.originalBy).toBe("singleimg");
  });

  // --- Video tweets are skipped ---

  it("skips video tweets during RapidAPI parsing", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);
    mockRecreatedTweetCreate.mockResolvedValueOnce({});
    mockTweet.mockResolvedValueOnce({ data: { id: "posted-text" } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          {
            id: "vid",
            text: "Video tweet",
            username: "a",
            likes: 500,
            hasVideo: true,
          },
          { id: "txt", text: "Text tweet", username: "b", likes: 100 },
        ]),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("recreated text tweet"),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    const data = await response.json();

    expect(data.recreated).toBe(true);
    // Should pick the text tweet since video is filtered
    expect(data.originalBy).toBe("b");
  });

  // --- DB save failure is non-fatal ---

  it("returns success even when DB save fails", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);
    mockRecreatedTweetCreate.mockRejectedValueOnce(new Error("DB error"));
    mockTweet.mockResolvedValueOnce({ data: { id: "posted-1" } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          { id: "t1", text: "Tweet", username: "user", likes: 100 },
        ]),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("recreated"),
    });

    const response = await POST(createPostRequest({ accountId: "acc-1" }));
    const data = await response.json();

    // Still reports success — DB save is non-fatal
    expect(data.recreated).toBe(true);
    expect(data.recreatedTweetId).toBe("posted-1");
  });

  // --- Logging ---

  it("creates logs throughout the pipeline", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
      expires: "",
    });
    mockAccountFindFirst.mockResolvedValueOnce(fullAccount);
    mockRecreatedTweetFindMany.mockResolvedValueOnce([]);
    mockRecreatedTweetCreate.mockResolvedValueOnce({});
    mockTweet.mockResolvedValueOnce({ data: { id: "posted-1" } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeRapidAPIResponse([
          { id: "t1", text: "Tweet", username: "user", likes: 100 },
        ]),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeOpenRouterResponse("recreated tweet"),
    });

    await POST(createPostRequest({ accountId: "acc-1" }));

    // Should have created multiple log entries
    const logCalls = mockLogCreate.mock.calls;
    expect(logCalls.length).toBeGreaterThanOrEqual(4);

    // Check key log messages exist
    const messages = logCalls.map(
      (call: [{ data: { message: string } }]) => call[0].data.message
    );
    expect(messages).toContain("Recreate pipeline started");
    expect(messages.some((m: string) => m.includes("Searching for"))).toBe(
      true
    );
    expect(messages.some((m: string) => m.includes("Selected tweet"))).toBe(
      true
    );
    expect(
      messages.some((m: string) => m.includes("Posted recreated tweet"))
    ).toBe(true);
  });
});
