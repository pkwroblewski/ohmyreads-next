"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SocialLinkInput {
  id?: string;
  platform: string;
  url: string;
  display_order: number;
}

interface SocialLinksEditorProps {
  links: SocialLinkInput[];
  onChange: (links: SocialLinkInput[]) => void;
}

const PLATFORMS = [
  { value: "twitter", label: "Twitter / X" },
  { value: "instagram", label: "Instagram" },
  { value: "goodreads", label: "Goodreads" },
  { value: "github", label: "GitHub" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "website", label: "Website" },
  { value: "other", label: "Other" },
];

const MAX_LINKS = 6;

export function SocialLinksEditor({ links, onChange }: SocialLinksEditorProps) {
  const handleAdd = () => {
    if (links.length >= MAX_LINKS) return;

    onChange([
      ...links,
      {
        // Client-only key so React tracks the row through reorders and
        // removals; the server assigns the real id and this one is not sent.
        id: crypto.randomUUID(),
        platform: "twitter",
        url: "",
        display_order: links.length,
      },
    ]);
  };

  const handleRemove = (index: number) => {
    const newLinks = links.filter((_, i) => i !== index);
    // Update display_order
    onChange(newLinks.map((link, i) => ({ ...link, display_order: i })));
  };

  const handleChange = (
    index: number,
    field: "platform" | "url",
    value: string
  ) => {
    const newLinks = [...links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    onChange(newLinks);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newLinks = [...links];
    [newLinks[index - 1], newLinks[index]] = [
      newLinks[index],
      newLinks[index - 1],
    ];
    onChange(newLinks.map((link, i) => ({ ...link, display_order: i })));
  };

  return (
    <div className="space-y-3">
      {links.map((link, index) => (
        <div
          key={link.id ?? `unsaved-${index}`}
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg",
            "bg-muted/50 border border-border"
          )}
        >
          {/* Reorder buttons */}
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => handleMoveUp(index)}
              disabled={index === 0}
              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              aria-label="Move up"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>

          {/* Platform Select */}
          <select
            value={link.platform}
            onChange={(e) => handleChange(index, "platform", e.target.value)}
            className={cn(
              "w-32 h-10 px-3 rounded-lg text-sm",
              "bg-background border border-input",
              "focus:outline-none focus:ring-2 focus:ring-ring"
            )}
          >
            {PLATFORMS.map((platform) => (
              <option key={platform.value} value={platform.value}>
                {platform.label}
              </option>
            ))}
          </select>

          {/* URL Input */}
          <Input
            type="url"
            value={link.url}
            onChange={(e) => handleChange(index, "url", e.target.value)}
            placeholder="https://..."
            className="flex-1"
          />

          {/* Delete Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleRemove(index)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label="Remove link"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Add Button */}
      {links.length < MAX_LINKS && (
        <Button
          type="button"
          variant="outline"
          onClick={handleAdd}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Link
        </Button>
      )}

      {links.length >= MAX_LINKS && (
        <p className="text-sm text-muted-foreground text-center">
          Maximum {MAX_LINKS} links allowed
        </p>
      )}
    </div>
  );
}

