import Anthropic from "@anthropic-ai/sdk";
import type { BookEvent } from "@/lib/queries/events";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate a weekly summary of literary events for a region
 */
export async function generateEventsSummary(
  events: BookEvent[],
  locationLabel?: string
): Promise<string> {
  if (events.length === 0) {
    return "No literary events found in your area this week. Check back soon for upcoming book signings, readings, and festivals!";
  }

  // Format events for the prompt
  const eventsList = events
    .slice(0, 10) // Limit to top 10 for summary
    .map((e) => {
      const date = new Date(e.start_date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return `- ${e.title} (${e.event_type}) at ${e.venue_name}, ${date}`;
    })
    .join("\n");

  const locationContext = locationLabel ? ` near ${locationLabel}` : "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are a helpful literary events curator. Write a brief, engaging 2-3 sentence summary of this week's literary events${locationContext}. Be warm and inviting, highlighting the most interesting events. Don't list all events, just give a flavor of what's happening.

Events this week:
${eventsList}

Write only the summary, no introduction or sign-off.`,
        },
      ],
    });

    // Extract text from response
    const textContent = message.content.find((c) => c.type === "text");
    if (textContent && textContent.type === "text") {
      return textContent.text.trim();
    }

    return generateFallbackSummary(events);
  } catch (error) {
    console.error("Error generating AI summary:", error);
    return generateFallbackSummary(events);
  }
}

/**
 * Fallback summary when AI is unavailable
 */
function generateFallbackSummary(events: BookEvent[]): string {
  const eventTypes = [...new Set(events.map((e) => e.event_type))];
  const typeLabels: Record<string, string> = {
    signing: "book signings",
    reading: "author readings",
    festival: "literary festivals",
    club: "book club meetings",
    workshop: "writing workshops",
    other: "literary events",
  };

  const typesText = eventTypes
    .slice(0, 3)
    .map((t) => typeLabels[t] || "events")
    .join(", ");

  return `Discover ${events.length} upcoming ${typesText} in your area this week. Explore the full list to find your next literary adventure!`;
}
