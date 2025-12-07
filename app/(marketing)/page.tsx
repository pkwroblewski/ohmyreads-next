import Link from "next/link";
import {
  BookOpen,
  Star,
  Users,
  BarChart3,
  Sparkles,
  Library,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Library,
    title: "Build Your Library",
    description:
      "Create your personal digital bookshelf. Track what you're reading, want to read, and have finished.",
  },
  {
    icon: Star,
    title: "Rate & Review",
    description:
      "Share your thoughts with the community. Write reviews and rate books on a 5-star scale.",
  },
  {
    icon: BarChart3,
    title: "Reading Stats",
    description:
      "Visualize your reading habits. Set goals, track streaks, and celebrate milestones.",
  },
  {
    icon: Users,
    title: "Connect with Readers",
    description:
      "Follow friends, discover what they're reading, and get personalized recommendations.",
  },
  {
    icon: MessageSquare,
    title: "Join Discussions",
    description:
      "Engage in thoughtful book discussions. Comment on reviews and share perspectives.",
  },
  {
    icon: TrendingUp,
    title: "Discover Trends",
    description:
      "Explore trending books, popular genres, and curated reading lists from the community.",
  },
];

const benefits = [
  "Free to use forever",
  "No ads, ever",
  "Privacy-focused",
  "Sync across devices",
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />

        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              <span>Your reading journey starts here</span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-serif tracking-tight mb-6">
              Track Your{" "}
              <span className="gradient-text">Reading Journey</span>
            </h1>

            {/* Subheading */}
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Discover books, write reviews, and connect with fellow readers.
              Build your personal library and never lose track of a great read.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto text-base px-8">
                  Start Reading Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/books">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto text-base px-8"
                >
                  Browse Books
                </Button>
              </Link>
            </div>

            {/* Benefits */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">
              Everything You Need
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features to enhance your reading experience and connect
              with a community of book lovers.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="group hover:border-primary/30 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl sm:text-5xl font-bold font-serif gradient-text mb-2">
                10K+
              </div>
              <div className="text-muted-foreground">Active Readers</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold font-serif gradient-text mb-2">
                50K+
              </div>
              <div className="text-muted-foreground">Books Tracked</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold font-serif gradient-text mb-2">
                25K+
              </div>
              <div className="text-muted-foreground">Reviews Written</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
              <BookOpen className="w-8 h-8" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">
              Ready to Start Your Journey?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of readers who are already tracking their reading
              adventures. It&apos;s free, forever.
            </p>
            <Link href="/signup">
              <Button size="lg" className="text-base px-8">
                Create Free Account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
