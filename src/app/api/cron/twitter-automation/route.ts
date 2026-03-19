import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBaseUrl } from "@/lib/utils";

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

    console.log(
      `Twitter reply: ${accountsToProcess.length}/${enabledConfigs.length} accounts pass schedule filter ` +
        `(schedules: ${enabledConfigs.map((c) => c.schedule).join(", ")})`
    );

    // Process accounts in parallel
    const CONCURRENCY_LIMIT = 25;
    const baseUrl = getBaseUrl(request);

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

    // --- Recreate pipeline ---
    const recreateConfigs = await db.twitterConfiguration.findMany({
      where: { recreateEnabled: true },
      include: {
        account: {
          include: {
            twitterCredentials: true,
          },
        },
      },
    });

    console.log(
      `Found ${recreateConfigs.length} recreate-enabled Twitter accounts`
    );

    const recreateAccountsToProcess = recreateConfigs.filter((config) => {
      const credentials = config.account.twitterCredentials;
      if (!credentials?.accessToken || !credentials?.rapidApiKey) {
        results.push({
          accountId: config.accountId,
          success: false,
          message: "[recreate] Missing Twitter credentials",
        });
        return false;
      }

      if (!checkSchedule(config.recreateSchedule)) {
        return false;
      }

      return true;
    });

    console.log(
      `Twitter recreate: ${recreateAccountsToProcess.length}/${recreateConfigs.length} accounts pass schedule filter ` +
        `(schedules: ${recreateConfigs.map((c) => c.recreateSchedule).join(", ")})`
    );

    const processRecreateAccount = async (
      config: (typeof recreateAccountsToProcess)[0]
    ) => {
      const accountId = config.accountId;
      try {
        const response = await fetch(`${baseUrl}/api/twitter/recreate`, {
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
            ? `[recreate] ${data.message || "Completed"}`
            : `[recreate] ${data.error || "Unknown error"}`,
        };
      } catch (error) {
        console.error(
          `Error processing recreate for account ${accountId}:`,
          error
        );
        return {
          accountId,
          success: false,
          message: `[recreate] ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    };

    for (
      let i = 0;
      i < recreateAccountsToProcess.length;
      i += CONCURRENCY_LIMIT
    ) {
      const batch = recreateAccountsToProcess.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(batch.map(processRecreateAccount));
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

/**
 * Check if the current 5-minute tick falls within the jittered
 * schedule window.  The cron fires every 5 minutes; this function
 * picks a random offset within each schedule interval so posts
 * don't always land at :00.  The offset is seeded per-interval so
 * it stays stable across the 5-min ticks within one period.
 *
 * Example for "every_hour": the interval is 60 min.  A hash of the
 * current hour produces a random minute (e.g. 23).  We fire on the
 * 5-min tick closest to that minute (i.e. :20 or :25).
 */
function checkSchedule(schedule: string): boolean {
  const now = new Date();
  const minutes = now.getMinutes();
  const hours = now.getHours();
  const day = now.getDate();

  switch (schedule) {
    case "every_5_min":
      return true;

    case "every_10_min": {
      // 2 slots per 10 min → pick one via jitter
      const period = Math.floor(minutes / 10);
      const jitterMin = seededRandom(hours * 100 + period + day) * 10;
      return minutes === nearestFiveMin(jitterMin) + period * 10;
    }

    case "every_30_min": {
      const period = Math.floor(minutes / 30);
      const jitterMin = seededRandom(hours * 10 + period + day) * 30;
      return minutes === nearestFiveMin(jitterMin) + period * 30;
    }

    case "every_hour": {
      const jitterMin = seededRandom(hours + day * 100) * 55;
      return minutes === nearestFiveMin(jitterMin);
    }

    case "every_3_hours": {
      if (hours % 3 !== 0) return false;
      const period3 = Math.floor(hours / 3);
      const jitterMin = seededRandom(period3 + day * 100) * 55;
      return minutes === nearestFiveMin(jitterMin);
    }

    case "every_6_hours": {
      if (hours % 6 !== 0) return false;
      const period6 = Math.floor(hours / 6);
      const jitterMin = seededRandom(period6 + day * 100) * 55;
      return minutes === nearestFiveMin(jitterMin);
    }

    default: {
      const jitterMin = seededRandom(hours + day * 100) * 55;
      return minutes === nearestFiveMin(jitterMin);
    }
  }
}

/** Round down to the nearest multiple of 5 (matching the 5-min cron ticks). */
function nearestFiveMin(n: number): number {
  return Math.floor(n / 5) * 5;
}

/** Simple deterministic hash → 0..1 from an integer seed. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
