"use client";

import { useState, useEffect, useTransition } from "react";
import { X, Loader2, FolderPlus, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getUserShelves,
  getBookShelves,
  getBookShelvesByBookId,
  updateBookShelves,
  updateBookShelvesByBookId,
  createShelf,
} from "@/lib/actions/shelves";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UserShelfWithCount } from "@/types/database";

interface AddToShelfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userBookId?: string;  // Optional - provide if book is already in user's library
  bookId?: string;      // Optional - provide for direct book-to-shelf (auto-creates user_book)
  bookTitle: string;
}

export function AddToShelfModal({
  open,
  onOpenChange,
  userBookId,
  bookId,
  bookTitle,
}: AddToShelfModalProps) {
  const [shelves, setShelves] = useState<UserShelfWithCount[]>([]);
  const [selectedShelfIds, setSelectedShelfIds] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [isCreating, setIsCreating] = useState(false);
  const [newShelfName, setNewShelfName] = useState("");
  const [isCreatingShelf, startCreatingShelf] = useTransition();
  // Track userBookId internally (may be set when bookId is used)
  const [resolvedUserBookId, setResolvedUserBookId] = useState<string | undefined>(userBookId);

  // Update resolvedUserBookId when prop changes
  useEffect(() => {
    setResolvedUserBookId(userBookId);
  }, [userBookId]);

  // Load shelves and current assignments
  useEffect(() => {
    if (open) {
      setIsLoading(true);

      // Determine how to fetch shelf assignments
      const fetchShelfAssignments = async () => {
        if (userBookId) {
          // Book is already in user's library
          return getBookShelves(userBookId);
        } else if (bookId) {
          // Book may or may not be in user's library
          const result = await getBookShelvesByBookId(bookId);
          if (result.success && result.userBookId) {
            setResolvedUserBookId(result.userBookId);
          }
          return result;
        }
        return { success: true as const, shelfIds: [] as string[] };
      };

      Promise.all([getUserShelves(), fetchShelfAssignments()])
        .then(([shelvesResult, bookShelvesResult]) => {
          if (shelvesResult.success) {
            setShelves(shelvesResult.shelves);
          }
          if (bookShelvesResult.success) {
            setSelectedShelfIds(new Set(bookShelvesResult.shelfIds));
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [open, userBookId, bookId]);

  const toggleShelf = (shelfId: string) => {
    setSelectedShelfIds((prev) => {
      const next = new Set(prev);
      if (next.has(shelfId)) {
        next.delete(shelfId);
      } else {
        next.add(shelfId);
      }
      return next;
    });
  };

  const handleSave = () => {
    startSaving(async () => {
      let result;

      if (resolvedUserBookId) {
        // Book is already in user's library - use standard update
        result = await updateBookShelves({
          userBookId: resolvedUserBookId,
          shelfIds: Array.from(selectedShelfIds),
        });
      } else if (bookId) {
        // Book not in library yet - use bookId-based update (auto-creates user_book)
        result = await updateBookShelvesByBookId({
          bookId,
          shelfIds: Array.from(selectedShelfIds),
        });
        // Update resolved userBookId for future operations
        if (result.success && result.userBookId) {
          setResolvedUserBookId(result.userBookId);
        }
      } else {
        toast.error("No book specified");
        return;
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Shelves updated!");
        onOpenChange(false);
      }
    });
  };

  const handleCreateShelf = () => {
    if (!newShelfName.trim()) return;

    startCreatingShelf(async () => {
      const result = await createShelf({ name: newShelfName.trim() });

      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success("Shelf created!");
        // Add new shelf to list and select it
        setShelves((prev) => [
          ...prev,
          { ...result.shelf, book_count: 0 },
        ]);
        setSelectedShelfIds((prev) => new Set([...prev, result.shelf.id]));
        setNewShelfName("");
        setIsCreating(false);
      }
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Add to Shelves</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Book title */}
        <div className="px-4 py-2 bg-muted/50 border-b">
          <p className="text-sm text-muted-foreground">
            Adding: <span className="font-medium text-foreground">{bookTitle}</span>
          </p>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : shelves.length === 0 && !isCreating ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No custom shelves yet
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first shelf
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Existing shelves */}
              {shelves.map((shelf) => (
                <button
                  key={shelf.id}
                  type="button"
                  onClick={() => toggleShelf(shelf.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
                    selectedShelfIds.has(shelf.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: shelf.color || "#6b7280" }}
                    />
                    <div className="text-left">
                      <p className="font-medium text-sm">{shelf.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {shelf.book_count} book
                        {shelf.book_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {selectedShelfIds.has(shelf.id) && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))}

              {/* Create new shelf */}
              {isCreating ? (
                <div className="p-3 rounded-lg border bg-card space-y-3">
                  <input
                    type="text"
                    value={newShelfName}
                    onChange={(e) => setNewShelfName(e.target.value)}
                    placeholder="New shelf name"
                    className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    maxLength={100}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newShelfName.trim()) {
                        handleCreateShelf();
                      } else if (e.key === "Escape") {
                        setIsCreating(false);
                        setNewShelfName("");
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCreating(false);
                        setNewShelfName("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateShelf}
                      disabled={!newShelfName.trim() || isCreatingShelf}
                    >
                      {isCreatingShelf ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Create"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed hover:bg-muted/50 transition-colors text-muted-foreground"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm">Create new shelf</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
