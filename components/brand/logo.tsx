import { cn } from "@/lib/utils";

/**
 * The OhMyReads mark: three spines on a shelf, the middle one ribbon red and
 * the last one leaning against it. Geometry lives in `LOGO_SPINES` so the app
 * icons and Open Graph image (`lib/brand/app-icon.tsx`) draw the same shape.
 */
export const LOGO_VIEWBOX = "0 0 32 32";
export const LOGO_SPINES = {
  // Drawn first so the ribbon spine sits in front of its top corner.
  leaning: { x: 20.5, y: 9, width: 6, height: 19.5, rotate: "rotate(-10 26.5 28.5)" },
  left: { x: 5, y: 7, width: 6, height: 21.5 },
  ribbon: { x: 12.5, y: 3, width: 6, height: 25.5 },
  shelf: { x: 3, y: 28, width: 26, height: 2 },
} as const;

interface LogoMarkProps {
  className?: string;
}

/** The mark alone. Spines use `currentColor`; the middle spine uses the ribbon token. */
export function LogoMark({ className }: LogoMarkProps) {
  const { leaning, left, ribbon, shelf } = LOGO_SPINES;
  return (
    <svg viewBox={LOGO_VIEWBOX} className={className} aria-hidden="true" focusable="false">
      <rect x={leaning.x} y={leaning.y} width={leaning.width} height={leaning.height} rx="1" fill="currentColor" transform={leaning.rotate} />
      <rect x={left.x} y={left.y} width={left.width} height={left.height} rx="1" fill="currentColor" />
      <rect x={ribbon.x} y={ribbon.y} width={ribbon.width} height={ribbon.height} rx="1" className="fill-primary" />
      <rect x={shelf.x} y={shelf.y} width={shelf.width} height={shelf.height} fill="currentColor" />
    </svg>
  );
}

interface LogoProps {
  /** "md" for the public navbar and footer, "sm" for the signed-in top bar. */
  size?: "sm" | "md";
  /** Hide the wordmark below the `sm` breakpoint (signed-in top bar). */
  wordmarkFromSm?: boolean;
  className?: string;
}

/** Mark plus the Literata wordmark. The parent link carries the accessible name. */
export function Logo({ size = "md", wordmarkFromSm = false, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center text-foreground", size === "md" ? "gap-2" : "gap-1.5", className)}>
      <LogoMark className={size === "md" ? "h-8 w-8" : "h-7 w-7"} />
      <span
        className={cn(
          "font-serif font-semibold tracking-tight",
          size === "md" ? "text-xl" : "text-lg",
          wordmarkFromSm && "hidden sm:inline"
        )}
      >
        OhMyReads
      </span>
    </span>
  );
}
