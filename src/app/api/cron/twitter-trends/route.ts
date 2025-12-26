import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Running Twitter trends cron job...");

    // TODO: Implement your Twitter trends fetching logic here
    // Example:
    // const twitter = getTwitterClient();
    // const trends = await twitter.getTrends("US");
    // await db.twitterTrend.createMany({ data: trends });

    return NextResponse.json({
      success: true,
      message: "Twitter trends fetched successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Twitter trends cron error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Twitter trends" },
      { status: 500 }
    );
  }
}
