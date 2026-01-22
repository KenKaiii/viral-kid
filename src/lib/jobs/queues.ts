import { Queue, type JobsOptions } from "bullmq";
import { createRedisClient } from "../redis";
import {
  JobNames,
  type JobName,
  type FetchTwitterTrendsData,
  type FetchYouTubeTrendsData,
  type RunRedditAutomationData,
  type AnalyzeViralContentData,
  type CleanupOldDataData,
  type InstagramProcessCommentData,
  type InstagramSendDmData,
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

export async function scheduleRunRedditAutomation(
  data: RunRedditAutomationData,
  options?: JobsOptions
): Promise<string> {
  return addJob(JobNames.RUN_REDDIT_AUTOMATION, data, options);
}

export async function scheduleInstagramProcessComment(
  data: InstagramProcessCommentData,
  options?: JobsOptions
): Promise<string> {
  return addJob(JobNames.INSTAGRAM_PROCESS_COMMENT, data, options);
}

export async function scheduleInstagramSendDm(
  data: InstagramSendDmData,
  options?: JobsOptions
): Promise<string> {
  return addJob(JobNames.INSTAGRAM_SEND_DM, data, options);
}

// Schedule repeatable/cron jobs
// All platform jobs run every 5 minutes (the shortest configurable interval).
// The cron endpoints use checkSchedule() to filter which accounts should actually
// run based on each account's configured schedule and the current time.
export async function setupRecurringJobs(): Promise<void> {
  const q = getQueue();

  // Remove old schedulers (migrating to consistent naming)
  await q.removeJobScheduler("twitter-automation-hourly").catch(() => {});
  await q.removeJobScheduler("reddit-automation-hourly").catch(() => {});
  await q.removeJobScheduler("youtube-comments-every-5min").catch(() => {});

  // Twitter automation - every 5 minutes
  // (cron endpoint filters based on per-account schedule setting)
  await q.upsertJobScheduler(
    "twitter-automation",
    { pattern: "*/5 * * * *" },
    {
      name: JobNames.FETCH_TWITTER_TRENDS,
      data: {},
    }
  );

  // YouTube comments automation - every 5 minutes
  // (cron endpoint filters based on per-account schedule setting)
  await q.upsertJobScheduler(
    "youtube-comments-automation",
    { pattern: "*/5 * * * *" },
    {
      name: JobNames.FETCH_YOUTUBE_TRENDS,
      data: {},
    }
  );

  // Reddit automation - every 5 minutes
  // (cron endpoint filters based on per-account schedule setting)
  await q.upsertJobScheduler(
    "reddit-automation",
    { pattern: "*/5 * * * *" },
    {
      name: JobNames.RUN_REDDIT_AUTOMATION,
      data: {},
    }
  );

  // Cleanup old data daily at 3 AM UTC
  await q.upsertJobScheduler(
    "cleanup-daily",
    { pattern: "0 3 * * *" },
    {
      name: JobNames.CLEANUP_OLD_DATA,
      data: { olderThanDays: 30 },
    }
  );

  console.log("Recurring jobs scheduled:");
  console.log(
    "  - Twitter automation: every 5 minutes (per-account filtering)"
  );
  console.log("  - YouTube comments: every 5 minutes (per-account filtering)");
  console.log("  - Reddit automation: every 5 minutes (per-account filtering)");
  console.log("  - Cleanup: daily at 3 AM UTC");
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
