import Link from "next/link";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NavbarUserMenu } from "./navbar-user-menu";
import { NavbarMobileMenu } from "./navbar-mobile-menu";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/books", label: "Browse" },
  { href: "/community", label: "Community" },
  { href: "/about", label: "About" },
];

const authNavLinks = [
  { href: "/dashboard", label: "Dashboard" },
];

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold font-serif tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              OhMyReads
            </span>
          </Link>

          {/* Center: Navigation Links (Desktop) */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg",
                  "text-muted-foreground hover:text-foreground",
                  "hover:bg-accent/10 transition-colors"
                )}
              >
                {link.label}
              </Link>
            ))}
            {user &&
              authNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg",
                    "text-muted-foreground hover:text-foreground",
                    "hover:bg-accent/10 transition-colors"
                  )}
                >
                  {link.label}
                </Link>
              ))}
          </div>

          {/* Right: Actions (Desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <NavbarUserMenu user={user} />
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
                <Link href="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <NavbarMobileMenu user={user} />
          </div>
        </div>
      </nav>
    </header>
  );
}
