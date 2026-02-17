"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Camera, Loader2, Trash2, X, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PlacePhotoUpload } from "./place-photo-upload";

interface Photo {
  id: string;
  url: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface PlacePhotosListProps {
  placeId: string;
  currentUserId?: string;
}

export function PlacePhotosList({ placeId, currentUserId }: PlacePhotosListProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPhotos = async () => {
    try {
      const response = await fetch(`/api/geo/places/${placeId}/photos`);
      if (response.ok) {
        const data = await response.json();
        setPhotos(data.photos || []);
      }
    } catch (error) {
      console.error("Error fetching photos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [placeId]);

  const handleUploadSuccess = () => {
    setShowUpload(false);
    fetchPhotos();
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/geo/places/${placeId}/photos?photoId=${photoId}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        setSelectedPhoto(null);
      }
    } catch (error) {
      console.error("Error deleting photo:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Photo Button */}
      {currentUserId && !showUpload && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowUpload(true)}
          className="w-full"
        >
          <Camera className="w-4 h-4 mr-2" />
          Add Photo
        </Button>
      )}

      {/* Upload Form */}
      {showUpload && currentUserId && (
        <div className="pb-4 border-b">
          <PlacePhotoUpload
            placeId={placeId}
            onSuccess={handleUploadSuccess}
            onCancel={() => setShowUpload(false)}
          />
        </div>
      )}

      {/* Photos Grid */}
      {photos.length === 0 ? (
        <p className="text-center text-muted-foreground py-6">
          No photos yet. Be the first to share a photo!
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Image
                src={photo.url}
                alt={photo.caption || "Place photo"}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 200px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-12 right-0 text-white hover:bg-white/20"
              onClick={() => setSelectedPhoto(null)}
            >
              <X className="w-6 h-6" />
            </Button>

            {/* Image */}
            <div className="relative flex-1 min-h-0">
              <Image
                src={selectedPhoto.url}
                alt={selectedPhoto.caption || "Place photo"}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>

            {/* Info */}
            <div className="bg-card rounded-lg p-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {selectedPhoto.user.avatar_url && (
                      <AvatarImage src={selectedPhoto.user.avatar_url} />
                    )}
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {selectedPhoto.user.display_name ||
                        selectedPhoto.user.username ||
                        "Anonymous"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(selectedPhoto.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {currentUserId === selectedPhoto.user.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeletePhoto(selectedPhoto.id)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>

              {selectedPhoto.caption && (
                <p className="text-sm mt-3">{selectedPhoto.caption}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
