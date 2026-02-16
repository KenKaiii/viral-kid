// Job names - add new job types here
export const JobNames = {
  RUN_TWITTER_AUTOMATION: "run-twitter-automation",
  RUN_YOUTUBE_AUTOMATION: "run-youtube-automation",
  RUN_REDDIT_AUTOMATION: "run-reddit-automation",
  ANALYZE_VIRAL_CONTENT: "analyze-viral-content",
  CLEANUP_OLD_DATA: "cleanup-old-data",
  INSTAGRAM_PROCESS_COMMENT: "instagram-process-comment",
  INSTAGRAM_SEND_DM: "instagram-send-dm",
} as const;

export type JobName = (typeof JobNames)[keyof typeof JobNames];

// Job data types - define the payload for each job type
export interface RunTwitterAutomationData {
  region?: string;
}

export interface RunYouTubeAutomationData {
  region?: string;
  categoryId?: string;
}

export interface AnalyzeViralContentData {
  contentId: string;
  platform: "twitter" | "youtube";
}

export interface CleanupOldDataData {
  olderThanDays: number;
}

export interface RunRedditAutomationData {
  region?: string;
}

// Instagram automation jobs
export interface InstagramProcessCommentData {
  accountId: string;
  automationId: string;
  commentId: string;
  commentText: string;
  commenterId: string;
  commenterUsername: string;
  mediaId: string;
}

export interface InstagramSendDmData {
  accountId: string;
  interactionId: string;
  recipientId: string;
  message: string;
}

// Union type for all job data
export type JobData =
  | RunTwitterAutomationData
  | RunYouTubeAutomationData
  | RunRedditAutomationData
  | AnalyzeViralContentData
  | CleanupOldDataData
  | InstagramProcessCommentData
  | InstagramSendDmData;

// Job result types
export interface JobResult {
  success: boolean;
  message?: string;
  data?: unknown;
}
