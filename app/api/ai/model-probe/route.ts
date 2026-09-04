/**
 * TEMPORARY diagnostic route (2026-09-04) — deleted once the Gemini 3.6 Flash
 * tool-calling stall is understood. Only the throwaway QA account can call it.
 *
 *   POST { mode: "list" }
 *   POST { mode: "generate" | "stream" | "raw", model?, tools?, thinking?, prompt?, maxOutputTokens? }
 */
import { generateText, streamText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { bookSearchTools } from "@/lib/ai/tools";
import { BOOK_SEARCH_SYSTEM_PROMPT } from "@/lib/ai/prompts";

export const maxDuration = 120;

const QA_USER_ID = "e8f9a2e0-b003-492d-9afa-06bce58f0243";

interface ProbeBody {
  mode: "list" | "generate" | "stream" | "raw";
  model?: string;
  tools?: boolean;
  thinking?: "minimal" | "low" | "medium" | "high" | "off" | "none";
  prompt?: string;
  system?: boolean;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

function describeError(error: unknown) {
  const e = error as { name?: string; message?: string; statusCode?: number; responseBody?: string };
  return {
    name: e?.name,
    message: e?.message?.slice(0, 500),
    statusCode: e?.statusCode,
    responseBody: e?.responseBody?.slice(0, 800),
  };
}

export async function POST(request: NextRequest) {
  const { data: { user } } = await getUser();
  if (!user || user.id !== QA_USER_ID) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as ProbeBody;
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no key" }, { status: 500 });

  const t0 = Date.now();
  const model = body.model ?? "gemini-3.6-flash";
  const prompt = body.prompt ?? "the hobbit";
  const timeoutMs = body.timeoutMs ?? 100_000;

  if (body.mode === "list") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${apiKey}`);
    const json = (await res.json()) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
    return NextResponse.json({
      ms: Date.now() - t0,
      status: res.status,
      models: (json.models ?? []).map((m) => `${m.name.replace("models/", "")} [${(m.supportedGenerationMethods ?? []).join(",")}]`),
    });
  }

  const thinking =
    body.thinking === "off" || body.thinking === "none"
      ? undefined
      : body.thinking
        ? { google: { thinkingConfig: { thinkingLevel: body.thinking } } }
        : undefined;

  if (body.mode === "raw") {
    // Straight REST call with one tiny function declaration, no SDK involved.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            ...(body.tools === false
              ? {}
              : {
                  tools: [
                    {
                      functionDeclarations: [
                        {
                          name: "searchBooks",
                          description: "Search the book catalog by title or author",
                          parameters: {
                            type: "object",
                            properties: { query: { type: "string", description: "title or author" } },
                            required: ["query"],
                          },
                        },
                      ],
                    },
                  ],
                }),
            generationConfig: {
              maxOutputTokens: body.maxOutputTokens ?? 800,
              ...(body.thinking && body.thinking !== "off" && body.thinking !== "none"
                ? { thinkingConfig: { thinkingLevel: body.thinking } }
                : {}),
            },
          }),
        }
      );
      const text = await res.text();
      return NextResponse.json({ ms: Date.now() - t0, status: res.status, body: text.slice(0, 1500) });
    } catch (error) {
      return NextResponse.json({ ms: Date.now() - t0, error: describeError(error) });
    } finally {
      clearTimeout(timer);
    }
  }

  const common = {
    model: google(model),
    system: body.system === false ? undefined : BOOK_SEARCH_SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: body.maxOutputTokens ?? 800,
    ...(body.tools === false ? {} : { tools: bookSearchTools, stopWhen: stepCountIs(3) }),
    ...(thinking ? { providerOptions: thinking } : {}),
    abortSignal: AbortSignal.timeout(timeoutMs),
    maxRetries: 0,
  };

  try {
    if (body.mode === "generate") {
      const result = await generateText(common);
      return NextResponse.json({
        ms: Date.now() - t0,
        finishReason: result.finishReason,
        usage: result.usage,
        steps: result.steps.map((s) => ({
          finishReason: s.finishReason,
          toolCalls: s.toolCalls.map((c) => c.toolName),
          textLength: s.text.length,
        })),
        text: result.text.slice(0, 300),
        warnings: result.warnings,
      });
    }

    const events: Array<[number, string]> = [];
    const result = streamText({
      ...common,
      onError: ({ error }) => {
        events.push([Date.now() - t0, "onError " + JSON.stringify(describeError(error))]);
      },
    });
    let text = "";
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") text += part.text;
      else if (part.type === "error") events.push([Date.now() - t0, "error " + JSON.stringify(describeError(part.error))]);
      else if (!part.type.includes("delta")) events.push([Date.now() - t0, part.type]);
    }
    return NextResponse.json({ ms: Date.now() - t0, events, text: text.slice(0, 300) });
  } catch (error) {
    return NextResponse.json({ ms: Date.now() - t0, error: describeError(error) });
  }
}
