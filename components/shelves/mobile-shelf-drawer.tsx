"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Folder, ChevronDown, Plus, Settings, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ShelfManager } from "./shelf-manager";
import { getUserShelves } from "@/lib/actions/shelves";
import { cn } from "@/lib/utils";
import type { UserShelfWithCount } from "@/types/database";

interface MobileShelfDrawerProps {
  activeShelfId?: string;
  /** From the server, since shelves only load once the drawer opens. */
  activeShelfName?: string | null;
}

export function MobileShelfDrawer({ activeShelfId, activeShelfName }: MobileShelfDrawerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shelves, setShelves] = useState<UserShelfWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const managerTriggerRef = useRef<HTMLButtonElement>(null);

  // Load shelves
  const loadShelves = async () => {
    setIsLoading(true);
    const result = await getUserShelves();
    if (result.success) {
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

  return (
    <>
      <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        {/* Trigger Button */}
        <DialogPrimitive.Trigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Folder className="h-4 w-4" />
            {activeShelfName ?? "Shelves"}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          {/* Backdrop */}
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />

          {/* Drawer Panel */}
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-xs bg-background shadow-xl animate-in slide-in-from-right duration-200 focus:outline-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-primary" aria-hidden="true" />
                <DialogPrimitive.Title className="font-semibold">Custom Shelves</DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="sm" aria-label="Close shelves">
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DialogPrimitive.Close>
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
                    ref={managerTriggerRef}
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
                  ref={managerTriggerRef}
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
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Shelf Manager Dialog */}
      <Dialog open={showManager} onOpenChange={setShowManager}>
        <DialogContent
          hideClose
          returnFocusTo={managerTriggerRef}
          aria-describedby={undefined}
          className="bg-background sm:max-w-md max-h-[80vh]"
        >
          <DialogTitle className="sr-only">Manage shelves</DialogTitle>
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
        </DialogContent>
      </Dialog>
    </>
  );
}
