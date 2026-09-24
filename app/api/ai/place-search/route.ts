import { generateText, stepCountIs, CoreMessage } from "ai";
import { google } from "@ai-sdk/google";
import { GEMINI_MODEL, GEMINI_CALL_OPTIONS } from "@/lib/ai/models";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { NextRequest } from "next/server";
import { placeSearchTools, extractPlaces } from "@/lib/ai/place-tools";
import { chatRequestSchema, chatMessageText, CHAT_HISTORY_LIMIT } from "@/lib/ai/schemas";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { getUser } from "@/lib/supabase/server";
import { validateOrigin } from "@/lib/utils/csrf";
import { reportError } from "@/lib/utils/log";

// System prompt for the place search assistant
const PLACE_SEARCH_SYSTEM_PROMPT = `You are a helpful assistant for OhMyReads, a reading community platform. Your role is to help users find literary places - bookstores, libraries, and cafes that are great for reading.

When users ask about places:
1. ALWAYS use the searchNearbyPlaces tool to find places near their location
2. Provide helpful information about each place (type, distance, open status)
3. If user asks for directions, use the getDirections tool

Understanding user queries:
- "bookstores near me" → searchNearbyPlaces with types=["bookstore"]
- "places within 15 min walk" → searchNearbyPlaces with maxMinutes=15, profile="walking"
- "cozy cafes" → searchNearbyPlaces with types=["cafe"]
- "libraries nearby" → searchNearbyPlaces with types=["library"]
- "how do I get to [place]" → getDirections with place coordinates

Place types available:
- bookstore: Bookstores and book shops
- library: Public libraries
- cafe: Cafes and coffee shops good for reading

IMPORTANT: The user's location (lat/lng) will be provided in the first message. Always use it for searches.

Guidelines:
- Be concise and helpful
- Highlight open/closed status when available
- Mention walking distance or time
- Format place names in **bold**
- If no places found, suggest expanding the search area or trying different types`;

/** Caps the assistant's prose reply; the place data itself comes from tools. */
const MAX_REPLY_TOKENS = 800;

// Select the AI model
function getModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google(GEMINI_MODEL);
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
    const { data: { user }, error: authError } = await getUser();
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

    // Rate limiting: 20 requests per minute per user
    const { allowed } = await checkRateLimit(`ai-place-search:${user.id}`, 20, 60000);

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid messages" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const { messages, location } = parsed.data;

    const model = getModel();

    // Add location context to system prompt if available
    let systemPrompt = PLACE_SEARCH_SYSTEM_PROMPT;
    if (location) {
      systemPrompt += `\n\nUser's current location: lat=${location.lat}, lng=${location.lng}. Use these coordinates for all searches.`;
    }

    // Convert UI messages to model messages format
    const modelMessages: CoreMessage[] = messages
      .slice(-CHAT_HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: chatMessageText(m) }));

    const result = await generateText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools: placeSearchTools,
      toolChoice: "auto",
      // `generateText` defaults to stepCountIs(1), so this loop was never
      // unbounded — it was cut one step too short. The model called
      // searchNearbyPlaces and stopped, leaving `result.text` empty, and the
      // client's `if (data.text)` then added no assistant message at all: the
      // place list updated while the assistant said nothing. Three steps give
      // it the follow-up turn to describe what it found (matching
      // book-search), and state the bound explicitly rather than by default.
      stopWhen: stepCountIs(3),
      maxOutputTokens: MAX_REPLY_TOKENS,
      ...GEMINI_CALL_OPTIONS,
      abortSignal: request.signal,
    });

    const places = extractPlaces(result.steps);

    return Response.json({
      text: result.text,
      places,
    });
  } catch (error) {
    const message = reportError("AI place search error", error);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
