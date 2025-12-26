// Job names - add new job types here
export const JobNames = {
  FETCH_TWITTER_TRENDS: "fetch-twitter-trends",
  FETCH_YOUTUBE_TRENDS: "fetch-youtube-trends",
  ANALYZE_VIRAL_CONTENT: "analyze-viral-content",
  CLEANUP_OLD_DATA: "cleanup-old-data",
} as const;

export type JobName = (typeof JobNames)[keyof typeof JobNames];

// Job data types - define the payload for each job type
export interface FetchTwitterTrendsData {
  region?: string;
}

export interface FetchYouTubeTrendsData {
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

// Union type for all job data
export type JobData =
  | FetchTwitterTrendsData
  | FetchYouTubeTrendsData
  | AnalyzeViralContentData
  | CleanupOldDataData;

// Job result types
export interface JobResult {
  success: boolean;
  message?: string;
  data?: unknown;
}
