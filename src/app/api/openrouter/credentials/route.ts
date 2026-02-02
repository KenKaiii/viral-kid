import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, getEffectiveUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db.account.findFirst({
      where: { id: accountId, userId: getEffectiveUserId(session)! },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const credentials = await db.openRouterCredentials.findUnique({
      where: { accountId },
    });

    if (!credentials) {
      return NextResponse.json({
        apiKey: "",
        systemPrompt: "",
        selectedModel: "",
        noHashtags: false,
        noEmojis: false,
        noCapitalization: false,
        badGrammar: false,
      });
    }

    return NextResponse.json({
      apiKey: credentials.apiKey ? "••••••••" : "",
      systemPrompt: credentials.systemPrompt || "",
      selectedModel: credentials.selectedModel || "",
      noHashtags: credentials.noHashtags,
      noEmojis: credentials.noEmojis,
      noCapitalization: credentials.noCapitalization,
      badGrammar: credentials.badGrammar,
      hasApiKey: !!credentials.apiKey,
    });
  } catch (error) {
    console.error("Failed to fetch OpenRouter credentials:", error);
    return NextResponse.json(
      { error: "Failed to fetch credentials" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db.account.findFirst({
      where: { id: accountId, userId: getEffectiveUserId(session)! },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      apiKey,
      systemPrompt,
      selectedModel,
      noHashtags,
      noEmojis,
      noCapitalization,
      badGrammar,
    } = body;

    // Build update/create data dynamically
    const updateData: {
      apiKey?: string;
      systemPrompt?: string;
      selectedModel?: string;
      noHashtags?: boolean;
      noEmojis?: boolean;
      noCapitalization?: boolean;
      badGrammar?: boolean;
    } = {};
    const createData: {
      accountId: string;
      apiKey?: string;
      systemPrompt?: string;
      selectedModel?: string;
      noHashtags?: boolean;
      noEmojis?: boolean;
      noCapitalization?: boolean;
      badGrammar?: boolean;
    } = { accountId };

    // Only save apiKey if it's a real key (not the masked placeholder)
    if (apiKey !== undefined && !apiKey.includes("•")) {
      updateData.apiKey = apiKey;
      createData.apiKey = apiKey;
    }
    if (systemPrompt !== undefined) {
      updateData.systemPrompt = systemPrompt;
      createData.systemPrompt = systemPrompt;
    }
    if (selectedModel !== undefined) {
      updateData.selectedModel = selectedModel;
      createData.selectedModel = selectedModel;
    }
    if (noHashtags !== undefined) {
      updateData.noHashtags = noHashtags;
      createData.noHashtags = noHashtags;
    }
    if (noEmojis !== undefined) {
      updateData.noEmojis = noEmojis;
      createData.noEmojis = noEmojis;
    }
    if (noCapitalization !== undefined) {
      updateData.noCapitalization = noCapitalization;
      createData.noCapitalization = noCapitalization;
    }
    if (badGrammar !== undefined) {
      updateData.badGrammar = badGrammar;
      createData.badGrammar = badGrammar;
    }

    const credentials = await db.openRouterCredentials.upsert({
      where: { accountId },
      update: updateData,
      create: createData,
    });

    return NextResponse.json({
      apiKey: credentials.apiKey ? "••••••••" : "",
      systemPrompt: credentials.systemPrompt || "",
      selectedModel: credentials.selectedModel || "",
      noHashtags: credentials.noHashtags,
      noEmojis: credentials.noEmojis,
      noCapitalization: credentials.noCapitalization,
      badGrammar: credentials.badGrammar,
      hasApiKey: !!credentials.apiKey,
    });
  } catch (error) {
    console.error("Failed to save OpenRouter credentials:", error);
    return NextResponse.json(
      { error: "Failed to save credentials" },
      { status: 500 }
    );
  }
}
