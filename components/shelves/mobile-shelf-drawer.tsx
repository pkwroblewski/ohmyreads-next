"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Folder, ChevronDown, Plus, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShelfManager } from "./shelf-manager";
import { getUserShelves } from "@/lib/actions/shelves";
import { cn } from "@/lib/utils";
import type { UserShelfWithCount } from "@/types/database";

interface MobileShelfDrawerProps {
  activeShelfId?: string;
}

export function MobileShelfDrawer({ activeShelfId }: MobileShelfDrawerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shelves, setShelves] = useState<UserShelfWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
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
    if (isOpen) {
      queueMicrotask(() => void loadShelves());
    }
  }, [isOpen]);

  const handleShelfClick = (shelfId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (shelfId) {
      params.set("shelf", shelfId);
      params.delete("status");
    } else {
      params.delete("shelf");
    }

    router.push(`/my-shelf?${params.toString()}`);
    setIsOpen(false);
  };

  const activeShelf = shelves.find((s) => s.id === activeShelfId);

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Folder className="h-4 w-4" />
        {activeShelf ? activeShelf.name : "Shelves"}
        <ChevronDown className="h-3 w-3" />
      </Button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-xs bg-background shadow-xl z-10 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Custom Shelves</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-140px)]">
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-2">Loading...</p>
              ) : shelves.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
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
                  {/* Show all books option */}
                  <button
                    type="button"
                    onClick={() => handleShelfClick(null)}
                    className={cn(
                      "w-full text-left py-3 px-3 rounded-lg transition-colors",
                      !activeShelfId
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="font-medium">All Books</span>
                  </button>

                  {/* Shelf list */}
                  {shelves.map((shelf) => (
                    <button
                      key={shelf.id}
                      type="button"
                      onClick={() => handleShelfClick(shelf.id)}
                      className={cn(
                        "w-full flex items-center justify-between py-3 px-3 rounded-lg transition-colors",
                        activeShelfId === shelf.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: shelf.color || "#6b7280" }}
                        />
                        <span className="font-medium">{shelf.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {shelf.book_count}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            {shelves.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManager(true)}
                  className="w-full"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Shelves
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shelf Manager Dialog */}
      {showManager && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowManager(false)}
          />
          <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-md z-10 p-6 max-h-[80vh] overflow-y-auto">
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
    </>
  );
}
