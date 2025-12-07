import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OhMyReads - Track Your Reading Journey",
  description:
    "Discover books, write reviews, and connect with fellow readers. Your personal book tracking companion.",
  keywords: ["books", "reading", "book tracking", "reviews", "library", "book club"],
  authors: [{ name: "OhMyReads" }],
  openGraph: {
    title: "OhMyReads - Track Your Reading Journey",
    description:
      "Discover books, write reviews, and connect with fellow readers. Your personal book tracking companion.",
    type: "website",
    siteName: "OhMyReads",
  },
  twitter: {
    card: "summary_large_image",
    title: "OhMyReads - Track Your Reading Journey",
    description:
      "Discover books, write reviews, and connect with fellow readers.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${playfair.variable} font-sans antialiased min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
