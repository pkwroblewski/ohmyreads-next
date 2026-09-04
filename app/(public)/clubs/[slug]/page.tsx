import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, BookOpen, Calendar, ArrowLeft, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClubBySlug, getClubMembers, getClubPastReads } from "@/lib/queries/clubs";
import { getUser } from "@/lib/supabase/server";
import { JoinButton } from "@/components/clubs/join-button";
import { SetCurrentBookDialog } from "@/components/clubs/set-current-book-dialog";
import { CoverImage } from "@/components/books/cover-image";

interface ClubPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ClubPageProps): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClubBySlug(slug);

  if (!club) {
    notFound();
  }

  return {
    title: `${club.name} | Book Clubs`,
    description: club.description || `Join ${club.name} on OhMyReads`,
    alternates: { canonical: `/clubs/${club.slug}` },
  };
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);

  if (!club) {
    notFound();
  }

  const {
    data: { user },
  } = await getUser();

  const [{ members }, pastReads] = await Promise.all([
    getClubMembers(club.id, { limit: 10 }),
    getClubPastReads(club.id),
  ]);

  const isAdmin = club.user_role === "admin";

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Back Link */}
      <Link
        href="/clubs"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Clubs
      </Link>

      {/* Club Header */}
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-10 w-10 text-primary" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{club.name}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {club.member_count} {club.member_count === 1 ? "member" : "members"}
                </span>
                {club.visibility === "private" && (
                  <Badge variant="outline">Private</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <SetCurrentBookDialog clubId={club.id} clubSlug={club.slug} />
                  <Button variant="outline" size="sm" disabled>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </>
              )}
              <JoinButton
                clubId={club.id}
                clubSlug={club.slug}
                isMember={club.is_member || false}
                userRole={club.user_role}
                isAuthenticated={!!user}
              />
            </div>
          </div>
          {club.description && (
            <p className="text-muted-foreground">{club.description}</p>
          )}
          {club.creator && (
            <p className="text-sm text-muted-foreground">
              Created by{" "}
              <Link
                href={`/users/${club.creator.username}`}
                className="text-primary hover:underline"
              >
                {club.creator.display_name || club.creator.username}
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Read */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Currently Reading
              </CardTitle>
            </CardHeader>
            <CardContent>
              {club.current_read ? (
                <Link href={`/books/${club.current_read.book.slug}`}>
                  <div className="flex gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <CoverImage
                      book={club.current_read.book}
                      width={64}
                      height={96}
                      hover={false}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{club.current_read.book.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {club.current_read.book.author}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Started {new Date(club.current_read.started_at ?? 0).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <p className="text-muted-foreground">
                    {isAdmin
                      ? "No book selected yet. Set a current read to get started!"
                      : "No book being read currently."}
                  </p>
                  {isAdmin && (
                    <SetCurrentBookDialog
                      clubId={club.id}
                      clubSlug={club.slug}
                      variant="default"
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Past Reads */}
          {pastReads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Previously Read</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pastReads.map((read) => (
                    <Link key={read.id} href={`/books/${read.book.slug}`}>
                      <div className="flex gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <CoverImage
                          book={read.book}
                          width={40}
                          height={60}
                          hover={false}
                          className="shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{read.book.title}</p>
                          <p className="text-xs text-muted-foreground">{read.book.author}</p>
                        </div>
                        {read.completed_at && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(read.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Members</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {club.member_count}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((member) => (
                  <Link key={member.user_id} href={`/users/${member.profile.username}`}>
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.profile.avatar_url || undefined} />
                        <AvatarFallback>
                          {(member.profile.display_name || member.profile.username)?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.profile.display_name || member.profile.username}
                        </p>
                        {member.role === "admin" && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            Admin
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
