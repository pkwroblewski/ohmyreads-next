import Link from "next/link";
import { BookOpen, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmptyStats() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <TrendingUp className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-3">No Reading Stats Yet</h1>
        <p className="text-muted-foreground mb-6">
          Start tracking your books to see your personalized reading insights,
          charts, and achievements here.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/books">
            <Button>
              <BookOpen className="h-4 w-4 mr-2" />
              Browse Books
            </Button>
          </Link>
          <Link href="/my-shelf">
            <Button variant="outline">Go to My Shelf</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

