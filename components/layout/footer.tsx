import Link from "next/link";
import { BookOpen, Leaf, Shield } from "lucide-react";
import { createClient, getUser } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const footerLinks = {
  product: [
    { href: "/books", label: "Browse Books" },
    { href: "/features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
  ],
  company: [
    { href: "/about", label: "About" },
    // Admin link added dynamically below
  ],
  legal: [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
  ],
};

// Check if user is admin (force dynamic by reading cookies)
async function getIsAdmin(): Promise<boolean> {
  try {
    // Force dynamic rendering
    await cookies();

    const supabase = await createClient();
    const { data: { user } } = await getUser();

    if (!user) return false;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    return profile?.is_admin || false;
  } catch {
    return false;
  }
}

export async function Footer() {
  const isAdmin = await getIsAdmin();

  return (
    <footer className="border-t border-border bg-muted/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Footer - 4 Column Grid */}
        <div className="py-12 grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Column 1: Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold font-serif tracking-tight">
                OhMyReads
              </span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              Independent Minds, Shared Stories
            </p>
            {/* Independence badge */}
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-md mb-4">
              <Leaf className="w-3.5 h-3.5 text-green-600 dark:text-green-500" />
              <span>Independent project • Not corporate-owned</span>
            </div>
          </div>

          {/* Column 2: Product */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Product
            </h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground/80 hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: OhMyReads.com */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              OhMyReads.com
            </h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground/80 hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {/* Admin link - only visible to admins, right after About */}
              {isAdmin && (
                <li>
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1.5 text-sm text-foreground/80 hover:text-primary transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Admin
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Legal
            </h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground/80 hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            © {new Date().getFullYear()} OhMyReads. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
