"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { addToShelf, removeFromShelf } from "@/lib/actions/books";

type ShelfStatus = "want_to_read" | "reading" | "read";

interface AddToShelfButtonProps {
  bookId: string;
  currentStatus?: ShelfStatus | null;
}

const statusConfig: Record<
  ShelfStatus,
  { label: string; icon: typeof BookOpen }
> = {
  want_to_read: { label: "Want to Read", icon: Bookmark },
  reading: { label: "Reading", icon: BookOpen },
  read: { label: "Read", icon: Check },
};

export function AddToShelfButton({
  bookId,
  currentStatus,
}: AddToShelfButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<ShelfStatus | null>(currentStatus ?? null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleStatusChange = (newStatus: ShelfStatus) => {
    setIsOpen(false);
    
    startTransition(async () => {
      const result = await addToShelf(bookId, newStatus);

      if (result.error) {
        // Redirect to login if not authenticated
        if (result.error === "Not authenticated") {
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
          return;
        }
        toast.error(result.error);
        return;
      }

      setStatus(newStatus);
      toast.success(`Book marked as "${statusConfig[newStatus].label}"`);
    });
  };

  const handleRemove = () => {
    setIsOpen(false);
    
    startTransition(async () => {
      const result = await removeFromShelf(bookId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setStatus(null);
      toast.success("Book removed from your shelf");
    });
  };

  const CurrentIcon = status ? statusConfig[status].icon : Plus;
  const buttonLabel = status ? statusConfig[status].label : "Add to Shelf";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className={cn(
          "min-w-[140px] justify-between",
          status && "bg-secondary text-secondary-foreground hover:bg-secondary/90"
        )}
      >
        <span className="flex items-center gap-2">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CurrentIcon className="h-4 w-4" />
          )}
          {buttonLabel}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 ml-2 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full left-0 mt-2 w-48 z-50",
            "rounded-lg border border-border bg-card shadow-lg",
            "py-1 animate-in fade-in-0 zoom-in-95"
          )}
        >
          {(Object.keys(statusConfig) as ShelfStatus[]).map((key) => {
            const config = statusConfig[key];
            const Icon = config.icon;
            const isSelected = status === key;

            return (
              <button
                key={key}
                onClick={() => handleStatusChange(key)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2 text-sm",
                  "hover:bg-muted transition-colors text-left",
                  isSelected && "text-primary"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{config.label}</span>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}

          {status && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                onClick={handleRemove}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2 text-sm",
                  "hover:bg-destructive/10 text-destructive transition-colors text-left"
                )}
              >
                <Trash2 className="h-4 w-4" />
                <span>Remove from Shelf</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

