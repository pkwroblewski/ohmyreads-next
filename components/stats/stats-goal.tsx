"use client";

import { useState, useTransition } from "react";
import { Target, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateReadingGoal } from "@/lib/actions/goals";

interface StatsGoalProps {
  goal: number | null;
  progress: number;
}

export default function StatsGoal({ goal, progress }: StatsGoalProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [newGoal, setNewGoal] = useState(goal?.toString() || "12");

  const currentYear = new Date().getFullYear();
  const targetGoal = goal || 12;
  const percentage = Math.min(Math.round((progress / targetGoal) * 100), 100);
  const remaining = Math.max(targetGoal - progress, 0);

  const handleSave = () => {
    const goalNum = parseInt(newGoal);
    if (isNaN(goalNum) || goalNum < 1 || goalNum > 1000) {
      toast.error("Please enter a valid goal (1-1000)");
      return;
    }

    startTransition(async () => {
      const result = await updateReadingGoal(goalNum);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Reading goal updated!");
        setIsEditing(false);
      }
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-1">
        <div
          className="h-2 bg-white/30 rounded-full overflow-hidden"
          style={{ width: "100%" }}
        >
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Target className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {currentYear} Reading Goal
              </h3>
              {isEditing ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    className="w-20 h-8"
                    min={1}
                    max={1000}
                  />
                  <span className="text-sm text-muted-foreground">books</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleSave}
                    disabled={isPending}
                    aria-label="Save reading goal"
                  >
                    <Check className="h-4 w-4 text-emerald-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setIsEditing(false)}
                    aria-label="Cancel editing goal"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  <span className="text-2xl font-bold text-foreground">
                    {progress}
                  </span>{" "}
                  of <span className="font-medium">{targetGoal}</span> books (
                  {percentage}%)
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
            {!isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="mb-2"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit Goal
                </Button>
                {remaining > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {remaining} more to go!
                  </p>
                ) : (
                  <p className="text-sm text-emerald-600 font-medium">
                    🎉 Goal achieved!
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

