import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OhMyReads | Track Your Reading Journey",
  description:
    "Discover, track, and share your reading journey. Build your personal library, write reviews, and connect with fellow book lovers.",
  keywords: ["books", "reading", "book tracking", "reviews", "library"],
  authors: [{ name: "OhMyReads" }],
  openGraph: {
    title: "OhMyReads | Track Your Reading Journey",
    description:
      "Discover, track, and share your reading journey. Build your personal library, write reviews, and connect with fellow book lovers.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
