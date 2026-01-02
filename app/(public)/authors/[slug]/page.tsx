import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Star, ArrowLeft } from "lucide-react";
import { getAuthorBySlug, getAllAuthors } from "@/lib/queries/authors";
import { BookCard } from "@/components/books/book-card";
import { safeJsonLd } from "@/lib/utils/jsonld";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);

  if (!author) {
    return { title: "Author Not Found" };
  }

  const description = `Explore ${author.books.length} book${author.books.length !== 1 ? "s" : ""} by ${author.name} on OhMyReads. Read reviews and add to your shelf.`;

  return {
    title: `${author.name} | OhMyReads`,
    description,
    openGraph: {
      title: `Books by ${author.name}`,
      description,
    },
    twitter: {
      card: "summary",
      title: `Books by ${author.name}`,
      description,
    },
  };
}

export async function generateStaticParams() {
  const authors = await getAllAuthors();
  // Generate pages for top 100 authors by book count
  return authors.slice(0, 100).map((author) => ({
    slug: author.slug,
  }));
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);

  if (!author) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  // Author JSON-LD Schema
  const authorJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    url: `${baseUrl}/authors/${author.slug}`,
    sameAs: [],
  };

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Authors",
        item: `${baseUrl}/authors`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: author.name,
        item: `${baseUrl}/authors/${author.slug}`,
      },
    ],
  };

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(authorJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />

      <div className="container max-w-6xl py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link
            href="/authors"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All Authors
          </Link>
        </nav>

        {/* Author Header */}
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold font-serif mb-3">
            {author.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {author.books.length} {author.books.length === 1 ? "book" : "books"}
            </span>
            {author.avgRating && (
              <span className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                {author.avgRating} average rating
                <span className="text-sm">
                  ({author.totalRatings.toLocaleString()} ratings)
                </span>
              </span>
            )}
          </div>
        </header>

        {/* Books Grid */}
        <section>
          <h2 className="text-xl font-semibold font-serif mb-6">
            Books by {author.name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {author.books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </section>

        {/* Related Authors - future enhancement */}
      </div>
    </>
  );
}
