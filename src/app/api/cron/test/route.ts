import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Test endpoint to verify parallel processing works correctly.
 * Simulates multiple accounts being processed in parallel.
 *
 * Usage:
 *   GET /api/cron/test?accounts=20&delay=2000
 *
 * Parameters:
 *   - accounts: Number of fake accounts to simulate (default: 15)
 *   - delay: Simulated processing time per account in ms (default: 2000)
 *   - concurrency: Max concurrent accounts (default: 10)
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  // Allow testing without CRON_SECRET in development, require it in production
  const authHeader = request.headers.get("authorization");

  if (process.env.NODE_ENV !== "development") {
    if (!process.env.CRON_SECRET) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const accountCount = parseInt(searchParams.get("accounts") || "15", 10);
  const delayMs = parseInt(searchParams.get("delay") || "2000", 10);
  const concurrencyLimit = parseInt(
    searchParams.get("concurrency") || "25",
    10
  );

  console.log(
    `Testing parallel processing: ${accountCount} accounts, ${delayMs}ms delay, ${concurrencyLimit} concurrent`
  );

  const startTime = Date.now();

  // Create fake accounts
  const platforms = ["twitter", "youtube", "reddit"];
  const fakeAccounts = Array.from({ length: accountCount }, (_, i) => ({
    accountId: `test-account-${i + 1}`,
    platform: platforms[i % 3] ?? "twitter",
  }));

  const results: Array<{
    accountId: string;
    platform: string;
    success: boolean;
    processingTime: number;
    startedAt: number;
    finishedAt: number;
  }> = [];

  // Simulate processing with delay
  const processAccount = async (account: (typeof fakeAccounts)[0]) => {
    const accountStart = Date.now();

    // Simulate API call with random variation (+/- 20%)
    const variation = delayMs * 0.2 * (Math.random() - 0.5);
    await new Promise((resolve) => setTimeout(resolve, delayMs + variation));

    const accountEnd = Date.now();

    return {
      accountId: account.accountId,
      platform: account.platform,
      success: Math.random() > 0.1, // 90% success rate simulation
      processingTime: accountEnd - accountStart,
      startedAt: accountStart - startTime,
      finishedAt: accountEnd - startTime,
    };
  };

  // Process in batches (same logic as real crons)
  for (let i = 0; i < fakeAccounts.length; i += concurrencyLimit) {
    const batch = fakeAccounts.slice(i, i + concurrencyLimit);
    const batchStart = Date.now() - startTime;
    console.log(
      `Processing batch ${Math.floor(i / concurrencyLimit) + 1}: accounts ${i + 1}-${Math.min(i + concurrencyLimit, fakeAccounts.length)} (started at ${batchStart}ms)`
    );

    const batchResults = await Promise.all(batch.map(processAccount));
    results.push(...batchResults);
  }

  const totalTime = Date.now() - startTime;

  // Calculate stats
  const sequentialTime = accountCount * delayMs;
  const speedup = sequentialTime / totalTime;
  const avgProcessingTime =
    results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;

  return NextResponse.json({
    success: true,
    test: true,
    config: {
      accounts: accountCount,
      delayPerAccount: delayMs,
      concurrencyLimit,
    },
    timing: {
      totalTimeMs: totalTime,
      sequentialWouldBe: sequentialTime,
      speedupFactor: speedup.toFixed(2) + "x",
      avgProcessingTimeMs: Math.round(avgProcessingTime),
    },
    summary: {
      processed: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    },
    // Show first few results with timing details
    sampleResults: results.slice(0, 20).map((r) => ({
      ...r,
      startedAt: `${r.startedAt}ms`,
      finishedAt: `${r.finishedAt}ms`,
      processingTime: `${r.processingTime}ms`,
    })),
    message: `Parallel processing test complete. ${speedup.toFixed(1)}x faster than sequential.`,
  });
}
