import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getRedisClient } from "@/lib/redis";

const RATE_LIMIT_WINDOW = 15 * 60; // 15 minutes in seconds
const MAX_ATTEMPTS = 5; // 5 attempts per window

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

async function isRateLimited(ip: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key = `signup_rate_limit:${ip}`;

    const count = await redis.incr(key);

    // Set expiry on first request
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW);
    }

    return count > MAX_ATTEMPTS;
  } catch (error) {
    // If Redis is unavailable, allow the request (fail open)
    // but log the error
    console.error("Rate limit check failed:", error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    // Rate limit check
    const clientIp = getClientIp(request);
    if (await isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password, token } = body;

    // Validate required fields
    if (!email || !password || !token) {
      return NextResponse.json(
        { error: "Email, password, and invite token are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Find the invite by token
    const invite = await db.invite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid invite token" },
        { status: 400 }
      );
    }

    // Check if invite has expired
    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: "Invite token has expired" },
        { status: 400 }
      );
    }

    // Check if invite has already been used
    if (invite.usedAt) {
      return NextResponse.json(
        { error: "Invite token has already been used" },
        { status: 400 }
      );
    }

    // Check if the email matches the invite
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "Email does not match the invite" },
        { status: 400 }
      );
    }

    // Hash password before transaction (CPU-intensive, don't hold transaction open)
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user, default accounts, and mark invite as used in a transaction
    // All checks are inside the transaction to prevent race conditions
    const user = await db.$transaction(async (tx) => {
      // Check if user already exists - inside transaction for atomicity
      const existingUser = await tx.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (existingUser) {
        throw new Error("User with this email already exists");
      }

      // Create the user
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          role: "USER",
        },
      });

      // Create default accounts for all platforms
      const platforms: Array<"twitter" | "youtube" | "instagram" | "reddit"> = [
        "twitter",
        "youtube",
        "instagram",
        "reddit",
      ];
      for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i]!;
        const platformData =
          platform === "twitter"
            ? {
                twitterCredentials: { create: {} },
                twitterConfig: { create: {} },
              }
            : platform === "youtube"
              ? {
                  youtubeCredentials: { create: {} },
                  youtubeConfig: { create: {} },
                }
              : platform === "instagram"
                ? {
                    instagramCredentials: { create: {} },
                    instagramConfig: { create: {} },
                  }
                : {
                    redditCredentials: { create: {} },
                    redditConfig: { create: {} },
                  };

        await tx.account.create({
          data: {
            platform,
            order: i,
            userId: newUser.id,
            ...platformData,
          },
        });
      }

      // Mark invite as used
      await tx.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      return newUser;
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    // Check if this is a user-exists error from our transaction
    if (error instanceof Error && error.message.includes("already exists")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}

// GET /api/auth/signup?token=xxx - Validate invite token
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const invite = await db.invite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json(
        { valid: false, error: "Invalid invite token" },
        { status: 400 }
      );
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { valid: false, error: "Invite token has expired" },
        { status: 400 }
      );
    }

    if (invite.usedAt) {
      return NextResponse.json(
        { valid: false, error: "Invite token has already been used" },
        { status: 400 }
      );
    }

    // Check if user already exists with this email
    const existingUser = await db.user.findUnique({
      where: { email: invite.email },
    });
    if (existingUser) {
      return NextResponse.json(
        { valid: false, error: "Account already exists for this email" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: invite.email,
    });
  } catch (error) {
    console.error("Failed to validate token:", error);
    return NextResponse.json(
      { error: "Failed to validate token" },
      { status: 500 }
    );
  }
}
