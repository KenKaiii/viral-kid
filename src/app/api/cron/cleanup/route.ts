import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLEANUP_OLDER_THAN_DAYS = 30;

export async function GET(request: Request): Promise<NextResponse> {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log(
      `Running cleanup cron job (removing data older than ${CLEANUP_OLDER_THAN_DAYS} days)...`
    );

    // TODO: Implement your cleanup logic here
    // Example:
    // const cutoffDate = new Date();
    // cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_OLDER_THAN_DAYS);
    // await db.twitterTrend.deleteMany({ where: { createdAt: { lt: cutoffDate } } });
    // await db.youtubeTrend.deleteMany({ where: { createdAt: { lt: cutoffDate } } });

    return NextResponse.json({
      success: true,
      message: `Cleaned up data older than ${CLEANUP_OLDER_THAN_DAYS} days`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cleanup cron error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup data" },
      { status: 500 }
    );
  }
}
