import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg px-3 py-2 text-sm",
          "bg-background text-foreground",
          "border border-input",
          "placeholder:text-muted-foreground",
          "transition-all duration-200",
          // Focus states
          "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          // File input styling
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          // Error state
          error && "border-destructive focus:ring-destructive/50 focus:border-destructive",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
