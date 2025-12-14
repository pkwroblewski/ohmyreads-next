"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Globe, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { submitPlace } from "@/lib/actions/places";
import { encodeGeohash } from "@/lib/utils/geohash";

const PLACE_TYPES = [
  { value: "bookstore", label: "Bookstore" },
  { value: "library", label: "Library" },
  { value: "cafe", label: "Book Cafe" },
  { value: "bookclub", label: "Book Club" },
  { value: "popup", label: "Pop-up Event" },
  { value: "other", label: "Other" },
];

export function PlaceSubmissionForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  const [name, setName] = useState("");
  const [placeType, setPlaceType] = useState<string>("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude);
        setLng(longitude);

        // Try to reverse geocode
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "User-Agent": "OhMyReads/1.0" } }
          );
          const data = await response.json();
          
          if (data.address) {
            setCity(data.address.city || data.address.town || data.address.village || "");
            setCountry(data.address.country || "");
            if (data.address.road) {
              setAddress(`${data.address.road}${data.address.house_number ? ` ${data.address.house_number}` : ""}`);
            }
          }
        } catch {
          // Ignore reverse geocoding errors
        }
        
        setIsGettingLocation(false);
        toast.success("Location set!");
      },
      () => {
        setIsGettingLocation(false);
        toast.error("Could not get your location");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    if (!placeType) {
      toast.error("Please select a place type");
      return;
    }

    startTransition(async () => {
      const result = await submitPlace({
        name: name.trim(),
        placeType: placeType as "bookstore" | "library" | "cafe" | "bookclub" | "popup" | "other",
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        lat: lat || undefined,
        lng: lng || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Place submitted for review!");
        router.push("/community/map");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Submit a Place</CardTitle>
          <CardDescription>
            Share a book-friendly location with the community. Your submission will be reviewed before appearing on the map.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Place Name *</Label>
            <Input
              id="name"
              placeholder="e.g., The Cozy Book Nook"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select value={placeType} onValueChange={setPlaceType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {PLACE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <Label>Location</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGetLocation}
              disabled={isGettingLocation}
            >
              {isGettingLocation ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              Use current location
            </Button>
            
            {lat && lng && (
              <p className="text-sm text-muted-foreground">
                📍 Location set ({lat.toFixed(4)}, {lng.toFixed(4)})
              </p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="Street address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={300}
            />
          </div>

          {/* City & Country */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="website"
                type="url"
                placeholder="https://..."
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="pl-10"
                maxLength={500}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Why is this place great for book lovers?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Submit */}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Submit for Review
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

