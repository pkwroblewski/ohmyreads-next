"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  variant?: "default" | "dropdown";
}

export function ThemeToggle({ className, variant = "default" }: ThemeToggleProps) {
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Cycle through themes: light → dark → system
  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-9 w-9", className)}
        aria-label="Toggle theme"
      >
        <span className="h-5 w-5" />
      </Button>
    );
  }

  const Icon = theme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;
  const label =
    theme === "system"
      ? "System theme"
      : resolvedTheme === "dark"
      ? "Dark mode"
      : "Light mode";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className={cn(
        "h-9 w-9 rounded-lg",
        "hover:bg-muted",
        "transition-colors duration-200",
        className
      )}
      aria-label={`Current: ${label}. Click to change theme.`}
    >
      <Sun
        className={cn(
          "h-5 w-5 transition-all duration-300",
          resolvedTheme === "dark" ? "rotate-90 scale-0" : "rotate-0 scale-100"
        )}
      />
      <Moon
        className={cn(
          "absolute h-5 w-5 transition-all duration-300",
          resolvedTheme === "dark" ? "rotate-0 scale-100" : "-rotate-90 scale-0"
        )}
      />
      {theme === "system" && (
        <Monitor
          className={cn(
            "absolute h-4 w-4 bottom-0.5 right-0.5",
            "text-muted-foreground"
          )}
        />
      )}
      <span className="sr-only">{label}</span>
    </Button>
  );
}

// Simple toggle between light and dark only
export function ThemeToggleSimple({ className }: { className?: string }) {
  const [mounted, setMounted] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-9 w-9", className)}
      >
        <span className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn("h-9 w-9 rounded-lg", className)}
      aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Sun
        className={cn(
          "h-5 w-5 transition-all duration-300",
          resolvedTheme === "dark" ? "rotate-90 scale-0" : "rotate-0 scale-100"
        )}
      />
      <Moon
        className={cn(
          "absolute h-5 w-5 transition-all duration-300",
          resolvedTheme === "dark" ? "rotate-0 scale-100" : "-rotate-90 scale-0"
        )}
      />
    </Button>
  );
}

