import { streamText, createUIMessageStreamResponse, UIMessage, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { NextRequest } from "next/server";
import { BOOK_SEARCH_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { bookSearchTools } from "@/lib/ai/tools";
import { checkRateLimit } from "@/lib/utils/rate-limit";

// Select the AI model based on environment or preference
// Default to Gemini Flash for cost efficiency
function getModel() {
  // Priority: Gemini (cheapest) > OpenAI > Anthropic
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google("gemini-2.0-flash");
  }
  if (process.env.OPENAI_API_KEY) {
    return openai("gpt-4o-mini");
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic("claude-3-5-haiku-latest");
  }
  throw new Error(
    "No AI API key configured. Please set GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY."
  );
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 30 requests per minute per IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const { allowed } = checkRateLimit(`ai-chat:${ip}`, 30, 60000);

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages } = (await request.json()) as { messages: UIMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const model = getModel();

    // Convert UI messages to model messages format
    const modelMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        typeof m.parts === "string"
          ? m.parts
          : m.parts?.map((p) => (p.type === "text" ? p.text : "")).join("") ||
            "",
    }));

    const result = streamText({
      model,
      system: BOOK_SEARCH_SYSTEM_PROMPT,
      messages: modelMessages,
      tools: bookSearchTools,
      toolChoice: "auto",
      stopWhen: stepCountIs(3), // Allow tool call + follow-up response with results
    });

    // Return as UI message stream for the DefaultChatTransport
    return createUIMessageStreamResponse({
      stream: result.toUIMessageStream(),
    });
  } catch (error) {
    console.error("AI book search error:", error);

    const message =
      error instanceof Error ? error.message : "An error occurred";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
