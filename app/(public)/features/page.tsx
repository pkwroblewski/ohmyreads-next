import { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Star,
  BarChart3,
  Users,
  MessageSquare,
  Library,
  Target,
  Share2,
  Bell,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Features - Everything You Need to Track Your Reading",
  description:
    "Discover all the features OhMyReads offers: structured reviews, reading stats, social features, book clubs, and more.",
};

const features = [
  {
    icon: BookOpen,
    title: "Smart Bookshelves",
    description:
      "Organize your books into customizable shelves. Track your progress and never lose track of a book again.",
  },
  {
    icon: Star,
    title: "Structured Reviews",
    description:
      "Write meaningful reviews with our structured format: share what you liked, what you didn't, and what you'll remember.",
  },
  {
    icon: BarChart3,
    title: "Reading Statistics",
    description:
      "Track your reading habits with beautiful stats. See books read, pages completed, and discover patterns.",
  },
  {
    icon: Users,
    title: "Social Features",
    description:
      "Connect with fellow readers. Follow friends, see what they're reading, and discover books through community.",
  },
  {
    icon: MessageSquare,
    title: "Comments & Discussions",
    description:
      "Engage with other readers through comments on reviews. Start discussions about your favorite books.",
  },
  {
    icon: Library,
    title: "Community Catalog",
    description:
      "Can't find a book? Submit it to our community catalog. Help grow our collection.",
  },
  {
    icon: Target,
    title: "Reading Goals",
    description:
      "Set annual or monthly reading goals and track your progress with visual indicators.",
  },
  {
    icon: Share2,
    title: "Easy Sharing",
    description:
      "Share your reviews and reading progress on social media. Recommend books to friends.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description:
      "Stay updated with notifications for new comments, followers, and friend activity.",
  },
  {
    icon: Shield,
    title: "Privacy Controls",
    description:
      "Control who sees your reading activity. Keep your shelves public or private.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="container max-w-6xl py-12 px-4">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">
          Everything You Need to{" "}
          <span className="text-primary">Track Your Reading</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          OhMyReads gives you powerful tools to organize your reading life,
          share your thoughts, and connect with fellow book lovers.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/signup">
            <Button size="lg">Get Started Free</Button>
          </Link>
          <Link href="/books">
            <Button size="lg" variant="outline">Browse Books</Button>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="group p-6 rounded-xl border bg-card shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
          >
            <div className="mb-4 p-2.5 rounded-lg bg-primary/10 w-fit group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-200">
              <feature.icon className="h-7 w-7 text-primary" strokeWidth={1.75} />
            </div>
            <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
            <p className="text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* CTA Section */}
      <div className="text-center py-12 px-6 rounded-2xl bg-muted/50">
        <h2 className="text-3xl font-bold font-serif mb-4">Ready to Start?</h2>
        <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
          Join readers who track their books on OhMyReads. It&apos;s free
          forever.
        </p>
        <Link href="/signup">
          <Button size="lg">Create Free Account</Button>
        </Link>
      </div>
    </div>
  );
}

