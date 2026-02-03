import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, getEffectiveUserId } from "@/lib/auth";

interface OpenRouterModelResponse {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
}

interface OpenRouterAPIResponse {
  data: OpenRouterModelResponse[];
}

// GET - Fetch models from database
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const visionOnly = url.searchParams.get("vision") === "true";

    const models = await db.openRouterModel.findMany({
      where: visionOnly ? { supportsVision: true } : undefined,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(models);
  } catch (error) {
    console.error("Failed to fetch OpenRouter models:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}

// POST - Sync models from OpenRouter API
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    let { apiKey } = body;
    const { accountId } = body;

    // If accountId provided and apiKey is masked/empty, fetch real key from DB
    if (accountId && (!apiKey || apiKey.includes("•"))) {
      const account = await db.account.findFirst({
        where: { id: accountId, userId: getEffectiveUserId(session)! },
      });
      if (!account) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }

      const credentials = await db.openRouterCredentials.findUnique({
        where: { accountId },
      });
      if (credentials?.apiKey) {
        apiKey = credentials.apiKey;
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key available" },
        { status: 400 }
      );
    }

    // Fetch models from OpenRouter API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json(
          { error: "Request timed out" },
          { status: 504 }
        );
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch models from OpenRouter" },
        { status: response.status }
      );
    }

    const data: OpenRouterAPIResponse = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return NextResponse.json(
        { error: "Invalid response from OpenRouter" },
        { status: 500 }
      );
    }

    // Known vision model patterns (fallback if architecture data is missing)
    // Updated 2026-02 based on current OpenRouter offerings
    const visionModelPatterns = [
      // OpenAI (GPT-5 series, GPT-4o still available)
      /gpt-5/i,
      /gpt-4o/i,
      // Anthropic (Claude 4/4.5 series)
      /claude-4/i,
      /claude-sonnet-4/i,
      /claude-opus-4/i,
      // Google (Gemini 2.5/3, Gemma 3)
      /gemini-3/i,
      /gemini-2\.5/i,
      /gemini-2\.0/i,
      /gemma-3/i,
      // Meta (Llama 4 Maverick/Scout)
      /llama-4/i,
      // Qwen VL series (qwen2.5-vl, qwen3-vl)
      /qwen3-vl/i,
      /qwen2\.5-vl/i,
      /qwen.*vl/i,
      // ByteDance Seed (multimodal)
      /seed-1\.6/i,
      /seed-1\.5/i,
      // Z.AI GLM vision models
      /glm-4\.6v/i,
      /glm-4\.5v/i,
      /glm-4v/i,
      // xAI Grok (vision capable)
      /grok-4/i,
      /grok.*vision/i,
      // Mistral
      /pixtral/i,
      // Other current vision models
      /deepseek.*vl/i,
      /internvl/i,
    ];

    const isVisionModel = (
      modelId: string,
      architecture?: { input_modalities?: string[] }
    ) => {
      // First check architecture data from API
      if (architecture?.input_modalities?.includes("image")) {
        return true;
      }
      // Fallback: check if model ID matches known vision patterns
      return visionModelPatterns.some((pattern) => pattern.test(modelId));
    };

    // Use transaction for batch upserts (more efficient than sequential)
    const modelData = data.data.map((model) => ({
      id: model.id,
      name: model.name || model.id,
      description: model.description || null,
      contextLength: model.context_length || 0,
      pricing: model.pricing ? JSON.stringify(model.pricing) : null,
      supportsVision: isVisionModel(model.id, model.architecture),
    }));

    // Batch upsert using transaction
    let syncedCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < modelData.length; i += BATCH_SIZE) {
      const batch = modelData.slice(i, i + BATCH_SIZE);
      try {
        await db.$transaction(
          batch.map((model) =>
            db.openRouterModel.upsert({
              where: { id: model.id },
              update: {
                name: model.name,
                description: model.description,
                contextLength: model.contextLength,
                pricing: model.pricing,
                supportsVision: model.supportsVision,
              },
              create: model,
            })
          )
        );
        syncedCount += batch.length;
      } catch (dbError) {
        console.error(`Failed to sync batch starting at ${i}:`, dbError);
      }
    }

    // Fetch updated models from database
    const models = await db.openRouterModel.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      total: data.data.length,
      models,
    });
  } catch (error) {
    console.error("Failed to sync OpenRouter models:", error);
    return NextResponse.json(
      { error: "Failed to sync models" },
      { status: 500 }
    );
  }
}
