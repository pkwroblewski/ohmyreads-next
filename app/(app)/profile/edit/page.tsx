"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SocialLinksEditor } from "@/components/social/social-links-editor";
import { createClient } from "@/lib/supabase/client";
import { updateProfile, updateSocialLinks } from "@/lib/actions/user";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Profile, SocialLink } from "@/types/database";

interface SocialLinkInput {
  id?: string;
  platform: string;
  url: string;
  display_order: number;
}

export default function EditProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile data
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");

  // Social links
  const [socialLinks, setSocialLinks] = useState<SocialLinkInput[]>([]);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setDisplayName(profileData.display_name || "");
        setUsername(profileData.username || "");
        setBio(profileData.bio || "");
        setWebsite(profileData.website || "");
      }

      // Fetch social links
      const { data: linksData } = await supabase
        .from("social_links")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });

      if (linksData) {
        setSocialLinks(
          linksData.map((link: SocialLink) => ({
            id: link.id,
            platform: link.platform,
            url: link.url,
            display_order: link.display_order,
          }))
        );
      }

      setIsLoading(false);
    }

    loadProfile();
  }, [router]);

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);

    try {
      // Update profile
      const profileResult = await updateProfile({
        display_name: displayName || undefined,
        username: username || undefined,
        bio: bio || undefined,
        website: website || undefined,
      });

      if (profileResult.error) {
        setError(profileResult.error);
        toast.error(profileResult.error);
        setIsSaving(false);
        return;
      }

      // Update social links
      const linksResult = await updateSocialLinks(socialLinks);

      if (linksResult.error) {
        setError(linksResult.error);
        toast.error(linksResult.error);
        setIsSaving(false);
        return;
      }

      toast.success("Profile updated successfully!");
      router.push("/profile");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold font-serif">Edit Profile</h1>
      </div>

      <div className="space-y-8">
        {/* Avatar Section */}
        <section className="flex items-center gap-6">
          <Avatar className="h-24 w-24">
            {profile?.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt={displayName} />
            )}
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl">
              {displayName?.[0]?.toUpperCase() || <User className="h-8 w-8" />}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button variant="outline" disabled>
              Change Avatar
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Avatar upload coming soon
            </p>
          </div>
        </section>

        {/* Profile Form */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Profile Information</h2>

          {/* Display Name */}
          <div className="space-y-2">
            <label htmlFor="display-name" className="text-sm font-medium">
              Display Name
            </label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
            />
          </div>

          {/* Username */}
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                id="username"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                }
                placeholder="username"
                className="pl-8"
                maxLength={30}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              3-30 characters. Letters, numbers, and underscores only.
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <label htmlFor="bio" className="text-sm font-medium">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              className={cn(
                "w-full min-h-[100px] p-3 rounded-lg resize-none",
                "bg-background border border-input",
                "focus:outline-none focus:ring-2 focus:ring-ring",
                "placeholder:text-muted-foreground"
              )}
              maxLength={500}
            />
            <p
              className={cn(
                "text-xs text-right",
                bio.length > 450 ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {bio.length}/500
            </p>
          </div>

          {/* Website */}
          <div className="space-y-2">
            <label htmlFor="website" className="text-sm font-medium">
              Website
            </label>
            <Input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourwebsite.com"
            />
          </div>
        </section>

        {/* Social Links Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Social Links</h2>
          <p className="text-sm text-muted-foreground">
            Add links to your social profiles. These will be shown on your
            public profile.
          </p>
          <SocialLinksEditor links={socialLinks} onChange={setSocialLinks} />
        </section>

        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Save Button */}
        <div className="flex gap-4 pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 sm:flex-none sm:min-w-[200px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
          <Link href="/profile" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full">
              Cancel
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
