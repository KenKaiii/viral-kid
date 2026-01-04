import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Running Twitter automation cron job...");

    // Find all Twitter accounts with automation enabled
    const enabledConfigs = await db.twitterConfiguration.findMany({
      where: { enabled: true },
      include: {
        account: {
          include: {
            twitterCredentials: true,
          },
        },
      },
    });

    console.log(`Found ${enabledConfigs.length} enabled Twitter accounts`);

    const results: Array<{
      accountId: string;
      success: boolean;
      message: string;
    }> = [];

    // Filter accounts that should run
    const accountsToProcess = enabledConfigs.filter((config) => {
      const credentials = config.account.twitterCredentials;
      if (!credentials?.accessToken || !credentials?.rapidApiKey) {
        results.push({
          accountId: config.accountId,
          success: false,
          message: "Missing Twitter credentials",
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
        const response = await fetch(`${baseUrl}/api/twitter/run`, {
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
              ? `Replied to @${data.repliedTo}`
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
      message: "Twitter automation cron completed",
      timestamp: new Date().toISOString(),
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Twitter automation cron error:", error);
    return NextResponse.json(
      { error: "Failed to process Twitter automation" },
      { status: 500 }
    );
  }
}

function checkSchedule(schedule: string): boolean {
  const now = new Date();
  const minutes = now.getMinutes();
  const hours = now.getHours();

  switch (schedule) {
    case "every_5_min":
      return true;
    case "every_10_min":
      return minutes % 10 === 0;
    case "every_30_min":
      return minutes === 0 || minutes === 30;
    case "every_hour":
      return minutes === 0;
    case "every_3_hours":
      return minutes === 0 && hours % 3 === 0;
    case "every_6_hours":
      return minutes === 0 && hours % 6 === 0;
    default:
      return minutes === 0;
  }
}
