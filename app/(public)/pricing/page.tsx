import { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing - Free Forever",
  description:
    "OhMyReads is free forever. Track unlimited books, write reviews, and connect with readers at no cost.",
};

const freeFeatures = [
  "Unlimited book tracking",
  "Structured reviews",
  "Reading statistics",
  "Social features",
  "Community catalog",
  "Reading goals",
  "Mobile-friendly",
  "Export your data",
];

const faqs = [
  {
    question: "Is OhMyReads really free?",
    answer:
      "Yes! All core features are free forever. We believe everyone should have access to great book tracking tools.",
  },
  {
    question: "Can I export my data?",
    answer:
      "Absolutely. Your data is yours and you can export it anytime from your settings.",
  },
  {
    question: "Will there be paid features in the future?",
    answer:
      "We may introduce optional premium features in the future, but core functionality will always remain free.",
  },
  {
    question: "How do you make money?",
    answer:
      "We're reader-funded and may introduce affiliate links to bookstores. We'll never sell your data.",
  },
];

export default function PricingPage() {
  return (
    <div className="container max-w-4xl py-12 px-4">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold font-serif mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-muted-foreground">
          OhMyReads is free for everyone. No credit card required.
        </p>
      </div>

      {/* Pricing Card */}
      <div className="max-w-md mx-auto mb-16">
        <div className="p-8 rounded-2xl border-2 border-primary bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium text-primary uppercase tracking-wider">
              Most Popular
            </span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Free Forever</h2>
          <p className="text-muted-foreground mb-4">
            Everything you need to track your reading
          </p>
          <div className="mb-6">
            <span className="text-5xl font-bold">$0</span>
            <span className="text-muted-foreground">/month</span>
          </div>

          <Link href="/signup" className="block w-full mb-6">
            <Button className="w-full" size="lg">Get Started</Button>
          </Link>

          <ul className="space-y-3">
            {freeFeatures.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold font-serif text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          {faqs.map((faq) => (
            <div key={faq.question}>
              <h3 className="font-semibold mb-2">{faq.question}</h3>
              <p className="text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center mt-16 py-12 px-6 rounded-2xl bg-muted/50">
        <h2 className="text-2xl font-bold mb-4">
          Ready to track your reading?
        </h2>
        <p className="text-muted-foreground mb-6">
          Free to join. No credit card required.
        </p>
        <Link href="/signup">
          <Button size="lg">Create Free Account</Button>
        </Link>
      </div>
    </div>
  );
}

