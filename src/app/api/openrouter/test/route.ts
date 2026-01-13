import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBaseUrl } from "@/lib/utils";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterChatRequest {
  model: string;
  messages: OpenRouterMessage[];
}

interface OpenRouterChatResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      systemPrompt,
      sampleContent,
      platform,
      noHashtags,
      noEmojis,
      noCapitalization,
      badGrammar,
    } = body;

    if (!sampleContent) {
      return NextResponse.json(
        { error: "sampleContent is required" },
        { status: 400 }
      );
    }

    // Fetch OpenRouter credentials for this account
    const credentials = await db.openRouterCredentials.findUnique({
      where: { accountId },
    });

    if (!credentials?.apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured for this account" },
        { status: 400 }
      );
    }

    if (!credentials?.selectedModel) {
      return NextResponse.json(
        { error: "No LLM model selected for this account" },
        { status: 400 }
      );
    }

    // Build the context based on platform
    const platformContext =
      platform === "twitter"
        ? "You are replying to a tweet on Twitter/X."
        : platform === "youtube"
          ? "You are replying to a YouTube comment."
          : "You are replying to an Instagram comment.";

    const contentType = platform === "twitter" ? "tweet" : "comment";

    // Build style rules based on options
    const styleRules: string[] = [];
    if (noHashtags) {
      styleRules.push("Do NOT use any hashtags in your response.");
    }
    if (noEmojis) {
      styleRules.push("Do NOT use any emojis in your response.");
    }
    if (noCapitalization) {
      styleRules.push(
        "Write entirely in lowercase letters. Do not capitalize anything, including the first letter of sentences or proper nouns."
      );
    }
    if (badGrammar) {
      styleRules.push(
        "Write in a casual, informal style with intentionally imperfect grammar. Use sentence fragments, skip punctuation sometimes, and write like you're texting a friend. Don't be too proper or formal."
      );
    }

    const styleSection =
      styleRules.length > 0
        ? `\n\nIMPORTANT STYLE RULES:\n${styleRules.join("\n")}`
        : "";

    // Construct the system message
    const fullSystemPrompt = systemPrompt
      ? `${systemPrompt}${styleSection}\n\n${platformContext}`
      : `${platformContext}${styleSection}`;

    // Construct the user message
    const userMessage = `Here is the ${contentType} you need to reply to:\n\n"${sampleContent}"\n\nWrite a reply to this ${contentType}.`;

    const messages: OpenRouterMessage[] = [
      { role: "system", content: fullSystemPrompt },
      { role: "user", content: userMessage },
    ];

    // Call OpenRouter API
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": getBaseUrl(request),
          "X-Title": "Viral Kid",
        },
        body: JSON.stringify({
          model: credentials.selectedModel,
          messages,
        } as OpenRouterChatRequest),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", errorText);
      return NextResponse.json(
        { error: `OpenRouter API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data: OpenRouterChatResponse = await response.json();

    if (!data.choices?.[0]?.message?.content) {
      return NextResponse.json(
        { error: "No response from model" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reply: data.choices[0].message.content,
      model: credentials.selectedModel,
    });
  } catch (error) {
    console.error("Failed to test system prompt:", error);
    return NextResponse.json(
      { error: "Failed to generate test response" },
      { status: 500 }
    );
  }
}
