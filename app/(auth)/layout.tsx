import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Auth Header */}
      <header className="w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            {/* Logo - links to homepage */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shadow-sm transition-all group-hover:scale-105">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold font-serif tracking-tight">
                OhMyReads
              </span>
            </Link>

            {/* Back to homepage link */}
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to homepage</span>
              <span className="sm:hidden">Home</span>
            </Link>
          </div>
        </nav>
      </header>

      {/* Main content - centered */}
      <main className="flex-1 flex items-center justify-center py-8">
        {children}
      </main>
    </div>
  );
}

