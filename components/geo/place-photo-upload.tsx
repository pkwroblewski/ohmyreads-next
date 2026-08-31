"use client";

import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PlacePhotoUploadProps {
  placeId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PlacePhotoUpload({
  placeId,
  onSuccess,
  onCancel,
}: PlacePhotoUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please select a JPEG, PNG, or WebP image");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be smaller than 5MB");
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (caption.trim()) {
        formData.append("caption", caption.trim());
      }

      const response = await fetch(`/api/geo/places/${placeId}/photos`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload photo");
      }

      // Success
      setSelectedFile(null);
      setPreview(null);
      setCaption("");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
    setCaption("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* File Input Area */}
      {!preview ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            "hover:border-primary hover:bg-primary/5",
            error ? "border-destructive" : "border-muted-foreground/25"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Click to select a photo</p>
          <p className="text-xs text-muted-foreground mt-1">
            JPEG, PNG, or WebP up to 5MB
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Preview */}
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Clear button */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 rounded-full"
            onClick={handleClear}
            aria-label="Remove selected photo"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Caption input */}
      {preview && (
        <div>
          <Input
            type="text"
            placeholder="Add a caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {caption.length}/200
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {preview && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="flex-1"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </>
            )}
          </Button>
        )}
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isUploading}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
