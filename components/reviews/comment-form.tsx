"use client";

import { useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createComment } from "@/lib/actions/comments";

interface CommentFormProps {
  reviewId: string;
  parentId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  placeholder?: string;
}

export function CommentForm({
  reviewId,
  parentId,
  onSuccess,
  onCancel,
  placeholder = "Write a comment...",
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) return;

    setIsSubmitting(true);

    try {
      const result = await createComment({
        reviewId,
        content: content.trim(),
        parentId: parentId || null,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(parentId ? "Reply posted!" : "Comment posted!");
        setContent("");
        onSuccess?.();
      }
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "flex-1 min-h-[60px] max-h-[120px] p-3 text-sm rounded-lg resize-none",
          "bg-background border border-input",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          "placeholder:text-muted-foreground"
        )}
        maxLength={1000}
        disabled={isSubmitting}
      />
      <div className="flex flex-col gap-1">
        <Button
          type="submit"
          size="icon"
          disabled={!content.trim() || isSubmitting}
          className="h-9 w-9"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-9 w-9"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

