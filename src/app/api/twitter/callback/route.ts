import crypto from "crypto";
import { NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { getBaseUrl } from "@/lib/utils";

// Timing-safe state comparison to prevent timing attacks
function isValidState(
  state: string | null,
  storedState: string | undefined
): boolean {
  if (!state || !storedState) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(state), Buffer.from(storedState));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request);

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Twitter OAuth error:", error);
      return NextResponse.redirect(new URL("/?error=oauth_denied", baseUrl));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/?error=missing_params", baseUrl));
    }

    const cookieStore = await cookies();
    const codeVerifier = cookieStore.get("twitter_code_verifier")?.value;
    const storedState = cookieStore.get("twitter_oauth_state")?.value;
    const accountId = cookieStore.get("twitter_account_id")?.value;

    if (!codeVerifier) {
      return NextResponse.redirect(
        new URL("/?error=missing_verifier", baseUrl)
      );
    }

    if (!isValidState(state, storedState)) {
      return NextResponse.redirect(new URL("/?error=state_mismatch", baseUrl));
    }

    if (!accountId) {
      return NextResponse.redirect(new URL("/?error=missing_account", baseUrl));
    }

    const credentials = await db.twitterCredentials.findUnique({
      where: { accountId },
    });

    if (!credentials?.clientId || !credentials?.clientSecret) {
      return NextResponse.redirect(new URL("/?error=no_credentials", baseUrl));
    }

    const client = new TwitterApi({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
    });

    const callbackUrl = `${baseUrl}/api/twitter/callback`;

    const {
      accessToken,
      refreshToken,
      expiresIn,
      client: loggedClient,
    } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: callbackUrl,
    });

    // Get the user info
    const { data: user } = await loggedClient.v2.me();

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Save tokens and user info
    await db.twitterCredentials.update({
      where: { accountId },
      data: {
        accessToken,
        refreshToken,
        tokenExpiresAt,
        userId: user.id,
        username: user.username,
      },
    });

    // Clear the OAuth cookies
    const response = NextResponse.redirect(
      new URL("/?success=twitter_connected", baseUrl)
    );

    response.cookies.delete("twitter_code_verifier");
    response.cookies.delete("twitter_oauth_state");
    response.cookies.delete("twitter_account_id");

    return response;
  } catch (error) {
    console.error("Twitter OAuth callback error:", error);
    return NextResponse.redirect(new URL("/?error=oauth_failed", baseUrl));
  }
}
