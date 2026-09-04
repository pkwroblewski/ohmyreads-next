import Link from "next/link";
import { ArrowRight, BookPlus, Check, Sparkles, Upload, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { FirstRunChecklist as Checklist, FirstRunStep } from "@/lib/queries/users";

interface FirstRunChecklistProps {
  checklist: Checklist;
}

const stepCopy: Record<
  FirstRunStep["key"],
  { title: string; description: string; href: string; cta: string; icon: LucideIcon }
> = {
  shelf: {
    title: "Add your first book",
    description: "Anything you are reading, have read, or mean to get to.",
    href: "/books",
    cta: "Browse books",
    icon: BookPlus,
  },
  taste: {
    title: "Set up your taste profile",
    description: "A few genres and favourites, and the recommendations start working.",
    href: "/onboarding/taste",
    cta: "Set up taste",
    icon: Sparkles,
  },
  follow: {
    title: "Follow a reader",
    description: "Their shelves and reviews turn up in your activity feed.",
    href: "/community",
    cta: "Find readers",
    icon: Users,
  },
};

/**
 * The dashboard's one place to start, for a reader who has not finished
 * setting up.
 *
 * It replaced a "Ready to start your reading journey?" card that sat below
 * five empty states, between them offering Browse Books three times and
 * Import from Goodreads twice. While this is on screen the sections above it
 * keep quiet, so every call to action is made exactly once.
 */
export function FirstRunChecklist({ checklist }: FirstRunChecklistProps) {
  const { steps, done, total } = checklist;

  return (
    <section className="mb-8">
      <div
        className={cn(
          "rounded-xl overflow-hidden",
          "bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5",
          "border border-primary/20"
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-5 pb-3">
          <h2 className="text-lg font-semibold font-serif">
            {done === 0 ? "Start here" : "Finish setting up"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {done} of {total} done
          </p>
        </div>

        <ol className="divide-y divide-border/60 border-t border-border/60">
          {steps.map((step) => {
            const copy = stepCopy[step.key];
            const Icon = copy.icon;
            return (
              <li
                key={step.key}
                className="flex items-center gap-3 px-5 py-3 sm:gap-4"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                    step.done
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step.done ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="sr-only">{step.done ? "Done:" : "To do:"}</span>
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.done && "text-muted-foreground line-through"
                    )}
                  >
                    {copy.title}
                  </p>
                  {!step.done && (
                    <p className="text-xs text-muted-foreground">{copy.description}</p>
                  )}
                </div>

                {!step.done && (
                  <Link
                    href={copy.href}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "flex-shrink-0"
                    )}
                  >
                    {copy.cta}
                    <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>

        {/* The shortcut for a reader who already has a library elsewhere.
            Not a step: nothing on the row records where a book came from. */}
        <p className="border-t border-border/60 px-5 py-3 text-sm text-muted-foreground">
          Already track your books somewhere else?{" "}
          <Link
            href="/import"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Import from Goodreads
          </Link>
        </p>
      </div>
    </section>
  );
}
