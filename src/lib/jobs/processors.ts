import type { Job } from "bullmq";
import {
  JobNames,
  type RunTwitterAutomationData,
  type RunYouTubeAutomationData,
  type AnalyzeViralContentData,
  type CleanupOldDataData,
  type InstagramProcessCommentData,
  type InstagramSendDmData,
  type JobResult,
  type RunRedditAutomationData,
} from "./types";
import { db } from "@/lib/db";
import {
  replyToComment,
  sendDirectMessage,
  parseTemplates,
  selectTemplate,
  interpolateTemplate,
} from "@/lib/instagram";
import { scheduleInstagramSendDm } from "./queues";

// Get the base URL for internal API calls
function getWorkerBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  return "http://localhost:3000";
}

// Helper to call internal cron endpoints
async function callCronEndpoint(
  path: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const baseUrl = getWorkerBaseUrl();
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return { success: false, error: "CRON_SECRET not configured" };
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// Job processor functions

async function processRunTwitterAutomation(
  _data: RunTwitterAutomationData
): Promise<JobResult> {
  console.log("Running Twitter automation via BullMQ...");
  const result = await callCronEndpoint("/api/cron/twitter-trends");

  if (!result.success) {
    return { success: false, message: result.error };
  }

  const data = result.data as { processed?: number; results?: unknown[] };
  return {
    success: true,
    message: `Twitter automation completed. Processed ${data.processed || 0} accounts.`,
    data: result.data,
  };
}

async function processRunYouTubeAutomation(
  _data: RunYouTubeAutomationData
): Promise<JobResult> {
  console.log("Running YouTube automation via BullMQ...");
  const result = await callCronEndpoint("/api/cron/youtube-comments");

  if (!result.success) {
    return { success: false, message: result.error };
  }

  const data = result.data as { processed?: number; results?: unknown[] };
  return {
    success: true,
    message: `YouTube automation completed. Processed ${data.processed || 0} accounts.`,
    data: result.data,
  };
}

async function processRunRedditAutomation(
  _data: RunRedditAutomationData
): Promise<JobResult> {
  console.log("Running Reddit automation via BullMQ...");
  const result = await callCronEndpoint("/api/cron/reddit");

  if (!result.success) {
    return { success: false, message: result.error };
  }

  const data = result.data as { processed?: number; results?: unknown[] };
  return {
    success: true,
    message: `Reddit automation completed. Processed ${data.processed || 0} accounts.`,
    data: result.data,
  };
}

async function processAnalyzeViralContent(
  data: AnalyzeViralContentData
): Promise<JobResult> {
  // Reserved for future content analysis features
  return {
    success: true,
    message: `Content ${data.contentId} analyzed`,
  };
}

async function processCleanupOldData(
  _data: CleanupOldDataData
): Promise<JobResult> {
  console.log("Running cleanup via BullMQ...");
  const result = await callCronEndpoint("/api/cron/cleanup");

  if (!result.success) {
    return { success: false, message: result.error };
  }

  const data = result.data as { deleted?: Record<string, number> };
  return {
    success: true,
    message: `Cleanup completed. Deleted: ${JSON.stringify(data.deleted || {})}`,
    data: result.data,
  };
}

/**
 * Process an Instagram comment - reply and schedule DM
 */
async function processInstagramComment(
  data: InstagramProcessCommentData
): Promise<JobResult> {
  const {
    accountId,
    automationId,
    commentId,
    commentText,
    commenterId,
    commenterUsername,
  } = data;

  // Fetch automation and credentials
  const automation = await db.instagramAutomation.findUnique({
    where: { id: automationId },
    include: {
      account: {
        include: {
          instagramCredentials: true,
        },
      },
    },
  });

  if (!automation || !automation.enabled) {
    return { success: false, message: "Automation not found or disabled" };
  }

  const credentials = automation.account.instagramCredentials;
  if (!credentials?.accessToken || !credentials?.instagramAccountId) {
    return { success: false, message: "Instagram credentials not configured" };
  }

  // Get interaction count for template rotation
  const interactionCount = await db.instagramInteraction.count({
    where: { automationId },
  });

  // Select and interpolate comment template
  const commentTemplates = parseTemplates(automation.commentTemplates);
  if (commentTemplates.length === 0) {
    return { success: false, message: "No comment templates configured" };
  }

  const selectedTemplate = selectTemplate(commentTemplates, interactionCount);
  const replyText = interpolateTemplate(selectedTemplate, {
    username: commenterUsername,
    comment: commentText,
  });

  // Reply to comment
  let replyResult;
  try {
    replyResult = await replyToComment(
      credentials.accessToken,
      commentId,
      replyText
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to reply: ${message}` };
  }

  // Create interaction record
  const interaction = await db.instagramInteraction.create({
    data: {
      accountId,
      automationId,
      commentId,
      commentText,
      commenterId,
      commenterUsername,
      keywordMatched: "", // Could be passed from webhook
      ourReply: replyText,
      ourReplyId: replyResult.commentId,
      repliedAt: new Date(),
    },
  });

  // Schedule DM with delay
  const dmTemplates = parseTemplates(automation.dmTemplates);
  if (dmTemplates.length > 0) {
    const dmTemplate = selectTemplate(dmTemplates, interactionCount);
    const dmMessage = interpolateTemplate(dmTemplate, {
      username: commenterUsername,
      comment: commentText,
    });

    // Schedule DM job with delay (in milliseconds)
    await scheduleInstagramSendDm(
      {
        accountId,
        interactionId: interaction.id,
        recipientId: commenterId,
        message: dmMessage,
      },
      {
        delay: automation.dmDelay * 1000, // Convert seconds to milliseconds
      }
    );
  }

  return {
    success: true,
    message: `Replied to comment from @${commenterUsername}`,
  };
}

/**
 * Send Instagram DM to a user
 */
async function processInstagramSendDm(
  data: InstagramSendDmData
): Promise<JobResult> {
  const { accountId, interactionId, recipientId, message } = data;

  // Fetch credentials
  const credentials = await db.instagramCredentials.findUnique({
    where: { accountId },
  });

  if (!credentials?.accessToken || !credentials?.instagramAccountId) {
    // Update interaction with error
    await db.instagramInteraction.update({
      where: { id: interactionId },
      data: { dmError: "Instagram credentials not configured" },
    });
    return { success: false, message: "Instagram credentials not configured" };
  }

  // Send DM
  const result = await sendDirectMessage(
    credentials.accessToken,
    credentials.instagramAccountId,
    recipientId,
    message
  );

  // Update interaction record
  if (result.success) {
    await db.instagramInteraction.update({
      where: { id: interactionId },
      data: {
        dmSent: true,
        dmContent: message,
        dmSentAt: new Date(),
      },
    });
    return { success: true, message: "DM sent successfully" };
  } else {
    await db.instagramInteraction.update({
      where: { id: interactionId },
      data: {
        dmError: result.error || "Failed to send DM",
      },
    });
    return { success: false, message: result.error || "Failed to send DM" };
  }
}

// Main job processor - routes jobs to appropriate handler
export async function processJob(job: Job): Promise<JobResult> {
  switch (job.name) {
    case JobNames.RUN_TWITTER_AUTOMATION:
      return processRunTwitterAutomation(job.data as RunTwitterAutomationData);

    case JobNames.RUN_YOUTUBE_AUTOMATION:
      return processRunYouTubeAutomation(job.data as RunYouTubeAutomationData);

    case JobNames.RUN_REDDIT_AUTOMATION:
      return processRunRedditAutomation(job.data as RunRedditAutomationData);

    case JobNames.ANALYZE_VIRAL_CONTENT:
      return processAnalyzeViralContent(job.data as AnalyzeViralContentData);

    case JobNames.CLEANUP_OLD_DATA:
      return processCleanupOldData(job.data as CleanupOldDataData);

    case JobNames.INSTAGRAM_PROCESS_COMMENT:
      return processInstagramComment(job.data as InstagramProcessCommentData);

    case JobNames.INSTAGRAM_SEND_DM:
      return processInstagramSendDm(job.data as InstagramSendDmData);

    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}
