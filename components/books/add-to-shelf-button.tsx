"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  FolderPlus,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { addToShelf, removeFromShelf } from "@/lib/actions/books";
import { AddToShelfModal } from "@/components/shelves/add-to-shelf-modal";

type ShelfStatus = "want_to_read" | "reading" | "read";

interface AddToShelfButtonProps {
  bookId: string;
  bookTitle?: string;  // For custom shelf modal
  currentStatus?: ShelfStatus | null;
  /** Lets a list owning several cards keep its own status map in step. */
  onStatusChange?: (status: ShelfStatus | null) => void;
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
  bookTitle,
  currentStatus,
  onStatusChange,
}: AddToShelfButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  // Derived state, not an effect: the local choice wins while the prop stays
  // put, and a changed prop (a refreshed server render after "Mark as
  // finished", say) wins over a local value seeded from the old one.
  const seed = currentStatus ?? null;
  const [chosen, setChosen] = useState<{ status: ShelfStatus | null; seed: ShelfStatus | null }>({
    status: seed,
    seed,
  });
  const status = chosen.seed === seed ? chosen.status : seed;
  const setStatus = (next: ShelfStatus | null) => setChosen({ status: next, seed });
  const [shelfModalOpen, setShelfModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleStatusChange = (newStatus: ShelfStatus) => {
    startTransition(async () => {
      const result = await addToShelf(bookId, newStatus);

      if (!result.success) {
        // Redirect to login if not authenticated
        if (result.error === "Not authenticated") {
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
          return;
        }
        toast.error(result.error);
        return;
      }

      setStatus(newStatus);
      onStatusChange?.(newStatus);
      toast.success(`Book marked as "${statusConfig[newStatus].label}"`);
      result.newBadges?.forEach((badge) => {
        toast.success(`Badge unlocked: ${badge.icon ?? "🏅"} ${badge.name}`);
      });
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeFromShelf(bookId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setStatus(null);
      onStatusChange?.(null);
      toast.success("Book removed from your shelf");
    });
  };

  const CurrentIcon = status ? statusConfig[status].icon : Plus;
  const buttonLabel = status ? statusConfig[status].label : "Add to Shelf";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            aria-busy={isPending}
            aria-label={status ? `Current status: ${buttonLabel}. Change status` : "Add book to shelf"}
            className={cn(
              "group min-w-[140px] justify-between",
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
              className="h-4 w-4 ml-2 transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuRadioGroup
            value={status ?? ""}
            onValueChange={(value) => handleStatusChange(value as ShelfStatus)}
          >
            {(Object.keys(statusConfig) as ShelfStatus[]).map((key) => {
              const Icon = statusConfig[key].icon;
              return (
                <DropdownMenuRadioItem key={key} value={key}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {statusConfig[key].label}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setShelfModalOpen(true)}>
            <FolderPlus className="h-4 w-4" aria-hidden="true" />
            Manage Shelves...
          </DropdownMenuItem>

          {status && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={handleRemove}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove from Shelf
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom Shelf Modal */}
      <AddToShelfModal
        open={shelfModalOpen}
        onOpenChange={setShelfModalOpen}
        bookId={bookId}
        bookTitle={bookTitle || "this book"}
        returnFocusTo={triggerRef}
      />
    </>
  );
}
