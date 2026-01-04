"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  FolderOpen,
  Lock,
  Globe,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createShelf,
  updateShelf,
  deleteShelf,
} from "@/lib/actions/shelves";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UserShelfWithCount } from "@/types/database";

// Preset colors for shelves
const SHELF_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
];

interface ShelfManagerProps {
  shelves: UserShelfWithCount[];
  onShelvesChange?: () => void;
}

export function ShelfManager({ shelves, onShelvesChange }: ShelfManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingShelf, setEditingShelf] = useState<UserShelfWithCount | null>(
    null
  );
  const [deletingShelfId, setDeletingShelfId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Custom Shelves</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCreating(true)}
          disabled={isCreating}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Shelf
        </Button>
      </div>

      {/* Create Form */}
      {isCreating && (
        <ShelfForm
          onSubmit={async (data) => {
            const result = await createShelf(data);
            if (result.error) {
              toast.error(result.error);
              return false;
            }
            toast.success("Shelf created!");
            setIsCreating(false);
            onShelvesChange?.();
            return true;
          }}
          onCancel={() => setIsCreating(false)}
        />
      )}

      {/* Shelves List */}
      {shelves.length === 0 && !isCreating ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No custom shelves yet. Create one to organize your books!
        </p>
      ) : (
        <div className="space-y-2">
          {shelves.map((shelf) => (
            <div key={shelf.id}>
              {editingShelf?.id === shelf.id ? (
                <ShelfForm
                  initialData={shelf}
                  onSubmit={async (data) => {
                    const result = await updateShelf({
                      shelfId: shelf.id,
                      ...data,
                    });
                    if (result.error) {
                      toast.error(result.error);
                      return false;
                    }
                    toast.success("Shelf updated!");
                    setEditingShelf(null);
                    onShelvesChange?.();
                    return true;
                  }}
                  onCancel={() => setEditingShelf(null)}
                />
              ) : (
                <ShelfItem
                  shelf={shelf}
                  onEdit={() => setEditingShelf(shelf)}
                  onDelete={() => setDeletingShelfId(shelf.id)}
                  isDeleting={deletingShelfId === shelf.id}
                  onConfirmDelete={async () => {
                    const result = await deleteShelf(shelf.id);
                    if (result.error) {
                      toast.error(result.error);
                    } else {
                      toast.success("Shelf deleted!");
                      onShelvesChange?.();
                    }
                    setDeletingShelfId(null);
                  }}
                  onCancelDelete={() => setDeletingShelfId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Individual shelf item
function ShelfItem({
  shelf,
  onEdit,
  onDelete,
  isDeleting,
  onConfirmDelete,
  onCancelDelete,
}: {
  shelf: UserShelfWithCount;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  onConfirmDelete: () => Promise<void>;
  onCancelDelete: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  if (isDeleting) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
        <p className="text-sm">Delete &ldquo;{shelf.name}&rdquo;?</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancelDelete}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              startTransition(async () => {
                await onConfirmDelete();
              });
            }}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Delete"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className="flex items-center gap-3">
        {/* Color indicator */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: shelf.color || "#6b7280" }}
        />

        {/* Shelf info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{shelf.name}</span>
            {shelf.is_public ? (
              <Globe className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Lock className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {shelf.book_count} book{shelf.book_count !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Shelf create/edit form
function ShelfForm({
  initialData,
  onSubmit,
  onCancel,
}: {
  initialData?: UserShelfWithCount;
  onSubmit: (data: {
    name: string;
    description?: string;
    isPublic?: boolean;
    color?: string;
  }) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [isPublic, setIsPublic] = useState(initialData?.is_public ?? true);
  const [color, setColor] = useState(initialData?.color || SHELF_COLORS[0]);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const success = await onSubmit({ name, description, isPublic, color });
      if (success) {
        setName("");
        setDescription("");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 rounded-lg border bg-card space-y-4"
    >
      {/* Name */}
      <div>
        <label className="text-sm font-medium" htmlFor="shelf-name">
          Shelf Name
        </label>
        <input
          id="shelf-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Favorites, To Re-read, Book Club"
          className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          maxLength={100}
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-sm font-medium" htmlFor="shelf-description">
          Description <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          id="shelf-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description of this shelf"
          className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          maxLength={200}
        />
      </div>

      {/* Color */}
      <div>
        <label className="text-sm font-medium">Color</label>
        <div className="flex gap-2 mt-1">
          {SHELF_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "w-6 h-6 rounded-full transition-transform",
                color === c && "ring-2 ring-offset-2 ring-primary scale-110"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Visibility */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="shelf-public"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="shelf-public" className="text-sm">
          Public shelf (visible on your profile)
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : initialData ? (
            "Save"
          ) : (
            "Create"
          )}
        </Button>
      </div>
    </form>
  );
}
