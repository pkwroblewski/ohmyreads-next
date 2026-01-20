"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Folder, ChevronDown, ChevronUp, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShelfManager } from "./shelf-manager";
import { getUserShelves } from "@/lib/actions/shelves";
import { cn } from "@/lib/utils";
import type { UserShelfWithCount } from "@/types/database";

interface ShelfSidebarProps {
  activeShelfId?: string;
}

export function ShelfSidebar({ activeShelfId }: ShelfSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shelves, setShelves] = useState<UserShelfWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showManager, setShowManager] = useState(false);

  // Load shelves
  const loadShelves = async () => {
    setIsLoading(true);
    const result = await getUserShelves();
    if (result.shelves) {
      setShelves(result.shelves);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    queueMicrotask(() => void loadShelves());
  }, []);

  const handleShelfClick = (shelfId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (shelfId) {
      params.set("shelf", shelfId);
      // Clear status filter when filtering by custom shelf
      params.delete("status");
    } else {
      params.delete("shelf");
    }

    router.push(`/my-shelf?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* Custom Shelves Section */}
      <div className="rounded-lg border bg-card">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Custom Shelves</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 space-y-1">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-2">Loading...</p>
            ) : shelves.length === 0 ? (
              <div className="py-2">
                <p className="text-sm text-muted-foreground mb-2">
                  No custom shelves yet
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManager(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Shelf
                </Button>
              </div>
            ) : (
              <>
                {/* Clear filter option */}
                {activeShelfId && (
                  <button
                    type="button"
                    onClick={() => handleShelfClick(null)}
                    className="w-full text-left text-sm py-1.5 px-2 rounded hover:bg-muted transition-colors text-muted-foreground"
                  >
                    Show all books
                  </button>
                )}

                {/* Shelf list */}
                {shelves.map((shelf) => (
                  <button
                    key={shelf.id}
                    type="button"
                    onClick={() => handleShelfClick(shelf.id)}
                    className={cn(
                      "w-full flex items-center justify-between py-1.5 px-2 rounded text-sm transition-colors",
                      activeShelfId === shelf.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: shelf.color || "#6b7280" }}
                      />
                      <span className="truncate">{shelf.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {shelf.book_count}
                    </span>
                  </button>
                ))}

                {/* Manage button */}
                <button
                  type="button"
                  onClick={() => setShowManager(true)}
                  className="w-full flex items-center gap-2 py-1.5 px-2 rounded text-sm text-muted-foreground hover:bg-muted transition-colors mt-2"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Manage Shelves
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Shelf Manager Dialog */}
      {showManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowManager(false)}
          />
          <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-md z-10 p-6">
            <ShelfManager
              shelves={shelves}
              onShelvesChange={() => {
                loadShelves();
              }}
            />
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowManager(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
