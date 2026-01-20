import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { getCuratedListWithBooks } from "@/lib/queries/lists";
import { getAllListSlugs } from "@/lib/data/curated-lists";
import { BookCard } from "@/components/books/book-card";
import { safeJsonLd } from "@/lib/utils/jsonld";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const list = await getCuratedListWithBooks(slug);

  if (!list) {
    return { title: "List Not Found" };
  }

  return {
    title: list.title,
    description: list.longDescription || list.description,
    openGraph: {
      title: list.title,
      description: list.longDescription || list.description,
    },
  };
}

export async function generateStaticParams() {
  return getAllListSlugs().map((slug) => ({ slug }));
}

export default async function ListPage({ params }: Props) {
  const { slug } = await params;
  const list = await getCuratedListWithBooks(slug);

  if (!list) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  // ItemList JSON-LD for SEO
  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: list.title,
    description: list.longDescription || list.description,
    url: `${baseUrl}/lists/${list.slug}`,
    numberOfItems: list.books.length,
    itemListElement: list.books.slice(0, 10).map((book, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Book",
        name: book.title,
        author: { "@type": "Person", name: book.author },
        url: `${baseUrl}/books/${book.slug}`,
      },
    })),
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
        name: "Reading Lists",
        item: `${baseUrl}/lists`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: list.title,
        item: `${baseUrl}/lists/${list.slug}`,
      },
    ],
  };

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(listJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />

      <div className="container max-w-6xl py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link
            href="/lists"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All Lists
          </Link>
        </nav>

        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-4xl">{list.icon || "📚"}</span>
            <h1 className="text-3xl md:text-4xl font-bold font-serif">
              {list.title}
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-3xl">
            {list.longDescription || list.description}
          </p>
          <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            {list.books.length} {list.books.length === 1 ? "book" : "books"}
          </div>
        </header>

        {/* Books Grid */}
        {list.books.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {list.books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No books found in this list yet.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
