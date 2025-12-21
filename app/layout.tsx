import type { Metadata } from "next";
import { Inter, Merriweather } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-merriweather",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com"),
  title: {
    default: "OhMyReads - Track Your Reading Journey",
    template: "%s | OhMyReads",
  },
  description:
    "Discover books, write reviews, and connect with fellow readers. The modern way to track and share your reading life.",
  keywords: [
    "book tracking",
    "reading list",
    "book reviews",
    "reading tracker",
    "goodreads alternative",
    "book recommendations",
    "reading journey",
  ],
  authors: [{ name: "OhMyReads" }],
  creator: "OhMyReads",
  publisher: "OhMyReads",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_SITE_URL,
    siteName: "OhMyReads",
    title: "OhMyReads - Track Your Reading Journey",
    description:
      "Discover books, write reviews, and connect with fellow readers.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "OhMyReads - Track Your Reading Journey",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OhMyReads - Track Your Reading Journey",
    description:
      "Discover books, write reviews, and connect with fellow readers.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${merriweather.variable} font-sans antialiased min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "!bg-card !text-card-foreground !border-border",
              duration: 4000,
            }}
            richColors
            closeButton
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
