import { Queue, type JobsOptions } from "bullmq";
import { createRedisClient } from "../redis";
import {
  JobNames,
  type JobName,
  type FetchTwitterTrendsData,
  type FetchYouTubeTrendsData,
  type AnalyzeViralContentData,
  type CleanupOldDataData,
} from "./types";

const QUEUE_NAME = "viral-kid-jobs";

// Singleton queue instance
let queue: Queue | null = null;

export function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: createRedisClient(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 500,
        },
      },
    });
  }
  return queue;
}

// Helper to add jobs with proper typing
export async function addJob<T>(
  name: JobName,
  data: T,
  options?: JobsOptions
): Promise<string> {
  const q = getQueue();
  const job = await q.add(name, data, options);
  return job.id ?? "";
}

// Convenience methods for each job type
export async function scheduleFetchTwitterTrends(
  data: FetchTwitterTrendsData,
  options?: JobsOptions
): Promise<string> {
  return addJob(JobNames.FETCH_TWITTER_TRENDS, data, options);
}

export async function scheduleFetchYouTubeTrends(
  data: FetchYouTubeTrendsData,
  options?: JobsOptions
): Promise<string> {
  return addJob(JobNames.FETCH_YOUTUBE_TRENDS, data, options);
}

export async function scheduleAnalyzeViralContent(
  data: AnalyzeViralContentData,
  options?: JobsOptions
): Promise<string> {
  return addJob(JobNames.ANALYZE_VIRAL_CONTENT, data, options);
}

export async function scheduleCleanupOldData(
  data: CleanupOldDataData,
  options?: JobsOptions
): Promise<string> {
  return addJob(JobNames.CLEANUP_OLD_DATA, data, options);
}

// Schedule repeatable/cron jobs
export async function setupRecurringJobs(): Promise<void> {
  const q = getQueue();

  // Fetch Twitter trends every hour
  await q.upsertJobScheduler(
    "twitter-trends-hourly",
    { pattern: "0 * * * *" }, // Every hour
    {
      name: JobNames.FETCH_TWITTER_TRENDS,
      data: { region: "US" },
    }
  );

  // Fetch YouTube trends every 2 hours
  await q.upsertJobScheduler(
    "youtube-trends-every-2h",
    { pattern: "0 */2 * * *" }, // Every 2 hours
    {
      name: JobNames.FETCH_YOUTUBE_TRENDS,
      data: { region: "US" },
    }
  );

  // Cleanup old data daily at 3 AM
  await q.upsertJobScheduler(
    "cleanup-daily",
    { pattern: "0 3 * * *" }, // Every day at 3 AM
    {
      name: JobNames.CLEANUP_OLD_DATA,
      data: { olderThanDays: 30 },
    }
  );

  console.log("Recurring jobs scheduled successfully");
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
