import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, getEffectiveUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db.account.findFirst({
      where: { id: accountId, userId: getEffectiveUserId(session)! },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const config = await db.redditConfiguration.findUnique({
      where: { accountId },
    });

    if (!config) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: config.id,
      enabled: config.enabled,
      schedule: config.schedule,
      keywords: config.keywords,
      timeRange: config.timeRange,
      minimumUpvotes: config.minimumUpvotes,
    });
  } catch (error) {
    console.error("Failed to fetch Reddit configuration:", error);
    return NextResponse.json(
      { error: "Failed to fetch configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db.account.findFirst({
      where: { id: accountId, userId: getEffectiveUserId(session)! },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const body = await request.json();
    const { schedule, keywords, timeRange, minimumUpvotes } = body;

    // Validate schedule value
    const validSchedules = [
      "every_5_min",
      "every_10_min",
      "every_30_min",
      "every_hour",
      "every_3_hours",
      "every_6_hours",
    ];

    if (schedule && !validSchedules.includes(schedule)) {
      return NextResponse.json(
        { error: "Invalid schedule value" },
        { status: 400 }
      );
    }

    // Validate timeRange value
    const validTimeRanges = ["hour", "day", "week", "month"];

    if (timeRange && !validTimeRanges.includes(timeRange)) {
      return NextResponse.json(
        { error: "Invalid timeRange value" },
        { status: 400 }
      );
    }

    // Validate minimumUpvotes
    if (
      minimumUpvotes !== undefined &&
      (typeof minimumUpvotes !== "number" || minimumUpvotes < 0)
    ) {
      return NextResponse.json(
        { error: "minimumUpvotes must be a non-negative number" },
        { status: 400 }
      );
    }

    const config = await db.redditConfiguration.update({
      where: { accountId },
      data: {
        ...(schedule && { schedule }),
        ...(keywords !== undefined && { keywords }),
        ...(timeRange && { timeRange }),
        ...(minimumUpvotes !== undefined && { minimumUpvotes }),
      },
    });

    return NextResponse.json({
      id: config.id,
      enabled: config.enabled,
      schedule: config.schedule,
      keywords: config.keywords,
      timeRange: config.timeRange,
      minimumUpvotes: config.minimumUpvotes,
    });
  } catch (error) {
    console.error("Failed to save Reddit configuration:", error);
    return NextResponse.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}
