"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  X,
  Loader2,
  MapPin,
  BookMarked,
  Landmark,
  Coffee,
  Clock,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AIPlaceSearchProps {
  userLocation: { lat: number; lng: number } | null;
  onPlaceSelect?: (place: {
    id: string;
    name: string;
    lat: number;
    lng: number;
  }) => void;
  className?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PlaceResult {
  id: string;
  name: string;
  type: string;
  address: string | null;
  distance_text: string;
  is_open: boolean | null;
  lat: number;
  lng: number;
}

const placeTypeConfig: Record<
  string,
  { icon: typeof BookMarked; color: string }
> = {
  bookstore: { icon: BookMarked, color: "text-amber-600" },
  library: { icon: Landmark, color: "text-sky-600" },
  cafe: { icon: Coffee, color: "text-orange-600" },
};

export function AIPlaceSearch({
  userLocation,
  onPlaceSelect,
  className,
}: AIPlaceSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !userLocation) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    setPlaces([]);

    try {
      // Build messages for the API
      const apiMessages = [
        ...messages,
        { role: "user" as const, content: userMessage },
      ].map((m) => ({
        role: m.role,
        parts: [{ type: "text" as const, text: m.content }],
      }));

      const res = await fetch("/api/ai/place-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          location: userLocation,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Search failed");
      }

      const data = await res.json();

      if (data.text) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.text },
        ]);
      }

      if (data.places && data.places.length > 0) {
        setPlaces(data.places);
      }
    } catch (error) {
      console.error("AI search error:", error);
      const errorMessage = error instanceof Error ? error.message : "Search failed";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessage.includes("API key")
            ? "AI search is not configured. Please use the regular search bar above."
            : "Sorry, I couldn't search for places right now. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!userLocation) {
    return null;
  }

  // Toggle button when closed
  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "bg-white/95 dark:bg-card/95 backdrop-blur-sm shadow-lg gap-1.5",
          className
        )}
        onClick={() => setIsOpen(true)}
      >
        <Sparkles className="h-4 w-4 text-primary" />
        Search
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "bg-white/95 dark:bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 w-80 max-h-[60vh] flex flex-col",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Find Places</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px]">
        {messages.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-4">
            <p className="mb-2">Try asking:</p>
            <div className="space-y-1">
              <p className="text-primary">&quot;bookstores within 10 min walk&quot;</p>
              <p className="text-primary">&quot;cozy cafes nearby&quot;</p>
              <p className="text-primary">&quot;libraries close to me&quot;</p>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "text-sm",
                m.role === "user"
                  ? "ml-8 p-2 bg-primary/10 rounded-lg text-right"
                  : "mr-8"
              )}
            >
              {m.content}
            </div>
          ))
        )}

        {/* Place Results */}
        {places.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            {places.map((place) => {
              const config = placeTypeConfig[place.type] || {
                icon: MapPin,
                color: "text-muted-foreground",
              };
              const Icon = config.icon;

              return (
                <button
                  key={place.id}
                  onClick={() => {
                    onPlaceSelect?.({
                      id: place.id,
                      name: place.name,
                      lat: place.lat,
                      lng: place.lng,
                    });
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <Icon className={cn("h-4 w-4", config.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{place.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {place.distance_text}
                      </span>
                      {place.is_open !== null && (
                        <span
                          className={
                            place.is_open ? "text-green-600" : "text-red-600"
                          }
                        >
                          {place.is_open ? "Open" : "Closed"}
                        </span>
                      )}
                    </div>
                  </div>
                  <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Searching...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about places..."
            className="flex-1 text-sm bg-muted/50 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8"
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
