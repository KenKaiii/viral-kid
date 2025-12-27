import { z } from "zod";

// Valid schedule options
export const scheduleOptions = [
  "every_5_min",
  "every_10_min",
  "every_30_min",
  "every_hour",
  "every_3_hours",
  "every_6_hours",
] as const;

export type ScheduleOption = (typeof scheduleOptions)[number];

// Valid platform options
export const platformOptions = ["twitter", "youtube", "instagram"] as const;

export type PlatformOption = (typeof platformOptions)[number];

// Valid log levels
export const logLevels = ["info", "warning", "error", "success"] as const;

export type LogLevel = (typeof logLevels)[number];

// Schemas
export const accountIdSchema = z.string().cuid();

export const platformSchema = z.enum(platformOptions);

export const scheduleSchema = z.enum(scheduleOptions);

export const logLevelSchema = z.enum(logLevels);

export const createAccountSchema = z.object({
  platform: platformSchema,
  name: z.string().optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

export const twitterConfigSchema = z.object({
  searchTerm: z.string().min(1).max(100).optional(),
  schedule: scheduleSchema.optional(),
  minimumLikesCount: z.number().int().min(0).max(1000000).optional(),
});

export const youtubeConfigSchema = z.object({
  schedule: scheduleSchema.optional(),
});

export const instagramConfigSchema = z.object({
  schedule: scheduleSchema.optional(),
});

export const createLogSchema = z.object({
  accountId: accountIdSchema,
  level: logLevelSchema,
  message: z.string().min(1).max(1000),
  metadata: z.string().optional(),
});

export const tweetInteractionSchema = z.object({
  accountId: accountIdSchema,
  tweetId: z.string().min(1),
  userTweet: z.string(),
  username: z.string(),
  views: z.number().int().min(0).optional(),
  hearts: z.number().int().min(0).optional(),
  replies: z.number().int().min(0).optional(),
  ourReply: z.string().optional(),
  ourReplyId: z.string().optional(),
});

// Helper to validate and parse request body
export async function parseBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return {
        success: false,
        error: result.error.issues.map((e) => e.message).join(", "),
      };
    }
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
}

// Helper to validate query parameters
export function parseQueryParam<T>(
  value: string | null,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  if (value === null) {
    return { success: false, error: "Parameter is required" };
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e) => e.message).join(", "),
    };
  }
  return { success: true, data: result.data };
}
