import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingDisplayProps {
  rating: number | null;
  count?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  /**
   * Where the number comes from. Cards mix this site's own ratings with the
   * Open Library figure, so an external rating carries a small "OL" tag the
   * way the book page spells out "on Open Library".
   */
  source?: "local" | "external";
}

const sizeConfig = {
  sm: {
    star: "h-3 w-3",
    text: "text-xs",
    gap: "gap-0.5",
  },
  md: {
    star: "h-4 w-4",
    text: "text-sm",
    gap: "gap-1",
  },
  lg: {
    star: "h-5 w-5",
    text: "text-base",
    gap: "gap-1",
  },
};

export function RatingDisplay({
  rating,
  count,
  size = "md",
  showCount = true,
  source,
}: RatingDisplayProps) {
  const config = sizeConfig[size];

  if (rating == null) return null;

  // Generate stars array
  const stars = Array.from({ length: 5 }, (_, index) => {
    const starPosition = index + 1;
    const isFull = rating >= starPosition;
    const isHalf = !isFull && rating >= starPosition - 0.5;

    return { isFull, isHalf };
  });

  const label = `${rating.toFixed(1)} out of 5${
    source === "external" ? " on Open Library" : ""
  }`;

  return (
    <div className={cn("flex items-center", config.gap)}>
      {/* The stars are one graphic with one text alternative; each glyph is
          decorative on its own. `text-star` is the contrast-checked gold. */}
      <div
        className={cn("flex items-center", config.gap)}
        role="img"
        aria-label={label}
      >
        {stars.map((star, index) => (
          <span key={index} className="relative" aria-hidden="true">
            {star.isFull ? (
              <Star className={cn(config.star, "text-star fill-star")} />
            ) : star.isHalf ? (
              <>
                {/* Empty star as background */}
                <Star className={cn(config.star, "text-muted-foreground/30")} />
                {/* Half star overlay */}
                <div className="absolute inset-0 overflow-hidden w-1/2">
                  <Star className={cn(config.star, "text-star fill-star")} />
                </div>
              </>
            ) : (
              <Star className={cn(config.star, "text-muted-foreground/30")} />
            )}
          </span>
        ))}
      </div>

      {showCount && count !== undefined && (
        <span className={cn("text-muted-foreground ml-1", config.text)}>
          ({count.toLocaleString()})
        </span>
      )}

      {source === "external" && (
        <abbr
          title="Open Library rating"
          className={cn(
            "ml-1 rounded px-1 font-medium uppercase tracking-wide no-underline",
            "bg-muted text-foreground",
            size === "sm" ? "text-[9px]" : "text-[10px]"
          )}
        >
          OL
        </abbr>
      )}
    </div>
  );
}
