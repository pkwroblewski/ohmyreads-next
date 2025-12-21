import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProfileByUsername } from "@/lib/queries/users";
import { getFollowing } from "@/lib/queries/follows";
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
    title: `People ${name} follows`,
    description: `See who ${name} follows on OhMyReads`,
  };
}

export default async function FollowingPage({ params }: Props) {
  const { username } = await params;

  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const following = await getFollowing(profile.id);
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
          {displayName} follows
        </h1>
        <p className="text-muted-foreground">
          {following.length} {following.length === 1 ? "person" : "people"}
        </p>
      </div>

      {/* Following List */}
      {following.length > 0 ? (
        <div className="space-y-4">
          {following.map((user) => (
            <Link
              key={user.id}
              href={`/users/${user.username}`}
              className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
            >
              <Avatar className="h-12 w-12">
                {user.avatar_url && (
                  <AvatarImage
                    src={user.avatar_url}
                    alt={user.display_name || user.username}
                  />
                )}
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                  {(user.display_name || user.username)[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {user.display_name || user.username}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  @{user.username}
                </p>
                {user.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                    {user.bio}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Not following anyone yet.</p>
        </div>
      )}
    </div>
  );
}
