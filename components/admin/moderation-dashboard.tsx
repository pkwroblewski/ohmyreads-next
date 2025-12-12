"use client";

import { useState } from "react";
import { Shield, Clock, CheckCircle, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import ModerationCard from "./moderation-card";
import type { BookSubmissionWithSubmitter } from "@/types/database";

interface ModerationDashboardProps {
  pendingSubmissions: BookSubmissionWithSubmitter[];
  submissionHistory: BookSubmissionWithSubmitter[];
}

export default function ModerationDashboard({
  pendingSubmissions,
  submissionHistory,
}: ModerationDashboardProps) {
  const [pending, setPending] = useState(pendingSubmissions);
  const [history, setHistory] = useState(submissionHistory);

  const handleModerated = (id: string, status: "approved" | "rejected") => {
    const submission = pending.find((s) => s.id === id);
    if (submission) {
      setPending((prev) => prev.filter((s) => s.id !== id));
      setHistory((prev) =>
        [{ ...submission, status }, ...prev].slice(0, 20)
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Book Moderation</h1>
          <p className="text-muted-foreground">
            Review and approve book submissions from users
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <Clock className="h-5 w-5" />
            <span className="font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold mt-1">{pending.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Approved</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {history.filter((s) => s.status === "approved").length}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">Rejected</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {history.filter((s) => s.status === "rejected").length}
          </p>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            Pending Review
            {pending.length > 0 && (
              <Badge variant="secondary">{pending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {pending.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">All caught up!</p>
              <p>No pending submissions to review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((submission) => (
                <ModerationCard
                  key={submission.id}
                  submission={submission}
                  onModerated={handleModerated}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No moderation history yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((submission) => (
                <ModerationCard
                  key={submission.id}
                  submission={submission}
                  readonly
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

