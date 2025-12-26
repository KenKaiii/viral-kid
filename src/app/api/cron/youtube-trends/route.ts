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
    console.log("Running YouTube trends cron job...");

    // TODO: Implement your YouTube trends fetching logic here
    // Example:
    // const youtube = getYouTubeClient();
    // const trends = await youtube.getTrendingVideos({ region: "US" });
    // await db.youtubeTrend.createMany({ data: trends });

    return NextResponse.json({
      success: true,
      message: "YouTube trends fetched successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("YouTube trends cron error:", error);
    return NextResponse.json(
      { error: "Failed to fetch YouTube trends" },
      { status: 500 }
    );
  }
}
