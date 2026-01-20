import { Metadata } from "next";
import { redirect } from "next/navigation";
import { Target, Trophy, Clock, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getChallenges } from "@/lib/actions/challenges";
import ChallengeCard from "@/components/challenges/challenge-card";
import CreateChallengeForm from "@/components/challenges/create-challenge-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Reading Challenges",
  description: "Set and track your personal reading challenges",
  robots: { index: false, follow: false },
};

export default async function ChallengesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/challenges");
  }

  const { data: challenges, error } = await getChallenges();

  const activeChallenges = challenges?.filter((c) => c.status === "active") || [];
  const completedChallenges =
    challenges?.filter((c) => c.status === "completed") || [];
  const pastChallenges =
    challenges?.filter((c) => c.status === "failed" || c.status === "abandoned") ||
    [];

  // Stats
  const totalCompleted = completedChallenges.length;
  const totalActive = activeChallenges.length;
  const onTrackCount = activeChallenges.filter((c) => c.is_on_track).length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/5 to-background border-b">
        <div className="container max-w-4xl py-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Target className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-serif">
                Reading Challenges
              </h1>
              <p className="text-muted-foreground">
                Set goals. Track progress. Achieve more.
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalActive}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{onTrackCount}</p>
                  <p className="text-sm text-muted-foreground">On Track</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalCompleted}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl py-8 space-y-8">
        {/* Create Challenge */}
        <section>
          <CreateChallengeForm />
        </section>

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            Error loading challenges: {error}
          </div>
        )}

        {/* Active Challenges */}
        {activeChallenges.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Active Challenges
            </h2>
            <div className="space-y-4">
              {activeChallenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          </section>
        )}

        {/* Completed Challenges */}
        {completedChallenges.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Completed Challenges
            </h2>
            <div className="space-y-4">
              {completedChallenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          </section>
        )}

        {/* Past Challenges */}
        {pastChallenges.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
              Past Challenges
            </h2>
            <div className="space-y-4 opacity-75">
              {pastChallenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {(!challenges || challenges.length === 0) && !error && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No challenges yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Create your first reading challenge to stay motivated and track
              your progress towards your reading goals.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
