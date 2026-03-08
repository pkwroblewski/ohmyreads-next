import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingDisplayProps {
  rating: number | null;
  count?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
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

  return (
    <div className={cn("flex items-center", config.gap)}>
      <div className={cn("flex items-center", config.gap)}>
        {stars.map((star, index) => (
          <span key={index} className="relative">
            {star.isFull ? (
              <Star
                className={cn(config.star, "text-accent fill-accent")}
              />
            ) : star.isHalf ? (
              <>
                {/* Empty star as background */}
                <Star
                  className={cn(config.star, "text-muted-foreground/30")}
                />
                {/* Half star overlay */}
                <div className="absolute inset-0 overflow-hidden w-1/2">
                  <Star
                    className={cn(config.star, "text-accent fill-accent")}
                  />
                </div>
              </>
            ) : (
              <Star
                className={cn(config.star, "text-muted-foreground/30")}
              />
            )}
          </span>
        ))}
      </div>
      
      {showCount && count !== undefined && (
        <span className={cn("text-muted-foreground ml-1", config.text)}>
          ({count.toLocaleString()})
        </span>
      )}
    </div>
  );
}

