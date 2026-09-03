import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Heart, Users, Target, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "About Us - Our Mission",
  description:
    "Learn about OhMyReads - the independent book tracking platform built for readers, not algorithms. Discover our mission to help you track and share your reading journey.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About OhMyReads - Our Mission",
    description:
      "Learn about OhMyReads - the independent book tracking platform built for readers. Discover, track, and share your reading journey.",
  },
};

const values = [
  {
    icon: Heart,
    title: "Passion for Reading",
    description:
      "We believe in the transformative power of books and want to help everyone discover their next great read.",
  },
  {
    icon: Users,
    title: "Community First",
    description:
      "Reading is better together. We're building a space where book lovers can connect and share their journeys.",
  },
  {
    icon: Target,
    title: "Simple & Focused",
    description:
      "No clutter, no distractions. Just the essential tools you need to track and enjoy your reading life.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
              <BookOpen className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold font-serif tracking-tight mb-6">
              About OhMyReads
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground">
              We&apos;re on a mission to help readers discover, track, and share
              their reading journeys with the world.
            </p>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold font-serif mb-6 text-center">
              Our Story
            </h2>
            <div className="prose prose-lg dark:prose-invert mx-auto text-muted-foreground">
              <p className="text-lg leading-relaxed mb-4">
                OhMyReads was born from a simple frustration: keeping track of
                all the books we wanted to read, were reading, and had finished
                was a mess. Spreadsheets were clunky, notes got lost, and
                existing apps felt overcomplicated.
              </p>
              <p className="text-lg leading-relaxed mb-4">
                We wanted something different—a beautiful, simple tool that
                made tracking your reading life a joy, not a chore. Something
                that would help us remember not just what we read, but how books
                made us feel.
              </p>
              <p className="text-lg leading-relaxed">
                So we built OhMyReads. A place where your books live, your
                thoughts are captured, and your reading journey unfolds
                beautifully over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">
              Our Values
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The principles that guide everything we build.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {values.map((value) => (
              <Card key={value.title} className="text-center">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                    <value.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">
              Join Our Community
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Start tracking your reading journey today. It&apos;s free, and
              always will be.
            </p>
            <Link href="/signup">
              <Button size="lg" className="text-base px-8">
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

