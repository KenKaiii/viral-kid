import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, getEffectiveUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

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

    const tweets = await db.recreatedTweet.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(tweets);
  } catch (error) {
    console.error("Failed to fetch tweets:", error);
    return NextResponse.json(
      { error: "Failed to fetch tweets" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const tweetId = searchParams.get("id");

    if (tweetId) {
      // Delete single recreated tweet - verify ownership through account
      const tweet = await db.recreatedTweet.findUnique({
        where: { id: tweetId },
        include: { account: true },
      });
      if (!tweet || tweet.account.userId !== session.user.id) {
        return NextResponse.json({ error: "Tweet not found" }, { status: 404 });
      }
      await db.recreatedTweet.delete({
        where: { id: tweetId },
      });
    } else if (accountId) {
      // Verify account belongs to user
      const account = await db.account.findFirst({
        where: { id: accountId, userId: getEffectiveUserId(session)! },
      });
      if (!account) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
      // Delete all recreated tweets for account
      await db.recreatedTweet.deleteMany({
        where: { accountId },
      });
    } else {
      return NextResponse.json(
        { error: "accountId or id is required" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tweet(s):", error);
    return NextResponse.json(
      { error: "Failed to delete tweet(s)" },
      { status: 500 }
    );
  }
}
