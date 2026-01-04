import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for processing multiple accounts

export async function GET(request: Request): Promise<NextResponse> {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Running YouTube comments cron job...");

    // Find all YouTube accounts with automation enabled
    const enabledConfigs = await db.youTubeConfiguration.findMany({
      where: { enabled: true },
      include: {
        account: {
          include: {
            youtubeCredentials: true,
          },
        },
      },
    });

    console.log(`Found ${enabledConfigs.length} enabled YouTube accounts`);

    const results: Array<{
      accountId: string;
      success: boolean;
      message: string;
    }> = [];

    // Filter accounts that should run
    const accountsToProcess = enabledConfigs.filter((config) => {
      const credentials = config.account.youtubeCredentials;
      if (!credentials?.accessToken || !credentials?.channelId) {
        results.push({
          accountId: config.accountId,
          success: false,
          message: "Missing YouTube credentials",
        });
        return false;
      }

      if (!checkSchedule(config.schedule)) {
        return false;
      }

      return true;
    });

    // Process accounts in parallel
    const CONCURRENCY_LIMIT = 25;
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000";

    const processAccount = async (config: (typeof accountsToProcess)[0]) => {
      const accountId = config.accountId;
      try {
        const response = await fetch(`${baseUrl}/api/youtube/run`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Cron-Secret": process.env.CRON_SECRET || "",
          },
          body: JSON.stringify({ accountId }),
        });

        const data = await response.json();

        return {
          accountId,
          success: response.ok,
          message: response.ok
            ? data.replied
              ? `Replied to ${data.repliedTo}`
              : data.message || "No action needed"
            : data.error || "Unknown error",
        };
      } catch (error) {
        console.error(`Error processing account ${accountId}:`, error);
        return {
          accountId,
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    };

    // Process in batches to respect concurrency limit
    for (let i = 0; i < accountsToProcess.length; i += CONCURRENCY_LIMIT) {
      const batch = accountsToProcess.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(batch.map(processAccount));
      results.push(...batchResults);
    }

    return NextResponse.json({
      success: true,
      message: "YouTube comments cron completed",
      timestamp: new Date().toISOString(),
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("YouTube comments cron error:", error);
    return NextResponse.json(
      { error: "Failed to process YouTube comments" },
      { status: 500 }
    );
  }
}

/**
 * Check if the current time matches the schedule
 * This cron runs every 5 minutes, so we check if the current schedule interval matches
 */
function checkSchedule(schedule: string): boolean {
  const now = new Date();
  const minutes = now.getMinutes();
  const hours = now.getHours();

  switch (schedule) {
    case "every_5_min":
      // Always run (cron runs every 5 min)
      return true;
    case "every_10_min":
      // Run on 0, 10, 20, 30, 40, 50
      return minutes % 10 === 0;
    case "every_30_min":
      // Run on 0, 30
      return minutes === 0 || minutes === 30;
    case "every_hour":
      // Run on the hour
      return minutes === 0;
    case "every_3_hours":
      // Run every 3 hours at the top of the hour
      return minutes === 0 && hours % 3 === 0;
    case "every_6_hours":
      // Run every 6 hours at the top of the hour
      return minutes === 0 && hours % 6 === 0;
    default:
      // Default to every hour
      return minutes === 0;
  }
}
