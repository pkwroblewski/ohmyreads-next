import { streamText, createUIMessageStreamResponse, UIMessage, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { NextRequest } from "next/server";
import { BOOK_SEARCH_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { bookSearchTools } from "@/lib/ai/tools";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { validateOrigin } from "@/lib/utils/csrf";
import { reportError } from "@/lib/utils/log";

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
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // CSRF protection: validate origin
    if (!validateOrigin(request)) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rate limiting: 30 requests per minute per user
    const { allowed } = await checkRateLimit(`ai-chat:${user.id}`, 30, 60000);

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
    // Never surface the raw message — getModel() throws one naming every AI
    // provider env var the deployment is missing.
    const message = reportError("AI book search error", error);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
