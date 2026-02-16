import { Queue, type JobsOptions } from "bullmq";
import { createRedisClient } from "../redis";
import {
  JobNames,
  type JobName,
  type RunTwitterAutomationData,
  type RunYouTubeAutomationData,
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
export async function scheduleRunTwitterAutomation(
  data: RunTwitterAutomationData,
  options?: JobsOptions
): Promise<string> {
  return addJob(JobNames.RUN_TWITTER_AUTOMATION, data, options);
}

export async function scheduleRunYouTubeAutomation(
  data: RunYouTubeAutomationData,
  options?: JobsOptions
): Promise<string> {
  return addJob(JobNames.RUN_YOUTUBE_AUTOMATION, data, options);
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

  // Remove old/zombie schedulers still persisted in Redis
  await q.removeJobScheduler("twitter-automation-hourly").catch(() => {});
  await q.removeJobScheduler("reddit-automation-hourly").catch(() => {});
  await q.removeJobScheduler("youtube-comments-every-5min").catch(() => {});
  await q.removeJobScheduler("twitter-trends-hourly").catch(() => {});
  await q.removeJobScheduler("youtube-trends-every-2h").catch(() => {});
  await q.removeJobScheduler("twitter-automation").catch(() => {});
  await q.removeJobScheduler("youtube-comments-automation").catch(() => {});
  await q.removeJobScheduler("reddit-automation").catch(() => {});

  // Twitter automation scheduler - polls every 5 minutes
  // (cron endpoint filters based on per-account schedule setting)
  await q.upsertJobScheduler(
    "scheduler-twitter-automation",
    { pattern: "*/5 * * * *" },
    {
      name: JobNames.RUN_TWITTER_AUTOMATION,
      data: {},
    }
  );

  // YouTube automation scheduler - polls every 5 minutes
  // (cron endpoint filters based on per-account schedule setting)
  await q.upsertJobScheduler(
    "scheduler-youtube-automation",
    { pattern: "*/5 * * * *" },
    {
      name: JobNames.RUN_YOUTUBE_AUTOMATION,
      data: {},
    }
  );

  // Reddit automation scheduler - polls every 5 minutes
  // (cron endpoint filters based on per-account schedule setting)
  await q.upsertJobScheduler(
    "scheduler-reddit-automation",
    { pattern: "*/5 * * * *" },
    {
      name: JobNames.RUN_REDDIT_AUTOMATION,
      data: {},
    }
  );

  // Cleanup old data daily at 3 AM UTC
  await q.upsertJobScheduler(
    "scheduler-cleanup",
    { pattern: "0 3 * * *" },
    {
      name: JobNames.CLEANUP_OLD_DATA,
      data: { olderThanDays: 30 },
    }
  );

  console.log("Recurring job schedulers registered:");
  console.log(
    "  - scheduler-twitter-automation: every 5 min (per-account filtering)"
  );
  console.log(
    "  - scheduler-youtube-automation: every 5 min (per-account filtering)"
  );
  console.log(
    "  - scheduler-reddit-automation: every 5 min (per-account filtering)"
  );
  console.log("  - scheduler-cleanup: daily at 3 AM UTC");
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
