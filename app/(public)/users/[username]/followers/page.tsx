import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProfileByUsername } from "@/lib/queries/users";
import { getFollowers } from "@/lib/queries/follows";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    return { title: "User Not Found" };
  }

  const name = profile.display_name || profile.username;

  return {
    title: `People following ${name}`,
    description: `See who follows ${name} on OhMyReads`,
  };
}

export default async function FollowersPage({ params }: Props) {
  const { username } = await params;

  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const followers = await getFollowers(profile.id);
  const displayName = profile.display_name || profile.username;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/users/${username}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>
        <h1 className="text-2xl font-bold font-serif">
          Followers of {displayName}
        </h1>
        <p className="text-muted-foreground">
          {followers.length} {followers.length === 1 ? "follower" : "followers"}
        </p>
      </div>

      {/* Followers List */}
      {followers.length > 0 ? (
        <div className="space-y-4">
          {followers.map((follower) => (
            <Link
              key={follower.id}
              href={`/users/${follower.username}`}
              className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
            >
              <Avatar className="h-12 w-12">
                {follower.avatar_url && (
                  <AvatarImage
                    src={follower.avatar_url}
                    alt={follower.display_name || follower.username}
                  />
                )}
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                  {(follower.display_name || follower.username)[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {follower.display_name || follower.username}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  @{follower.username}
                </p>
                {follower.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                    {follower.bio}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No followers yet.</p>
        </div>
      )}
    </div>
  );
}
