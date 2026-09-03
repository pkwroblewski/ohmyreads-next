import { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { getAllAuthors } from "@/lib/queries/authors";
import { CURATED_LISTS } from "@/lib/data/curated-lists";

type Entry = MetadataRoute.Sitemap[number];

/** A `lastModified` only when the row actually carries a date. */
function lastModified(iso: string | null | undefined): Pick<Entry, "lastModified"> {
  return iso ? { lastModified: new Date(iso) } : {};
}

/** Newest ISO date per key (author slug or list slug) across a set of books. */
function newest(
  pairs: Iterable<readonly [key: string | null | undefined, iso: string | null | undefined]>
): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, iso] of pairs) {
    if (!key || !iso) continue;
    const prev = out.get(key);
    if (!prev || iso > prev) out.set(key, iso);
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  // Static pages. Only routes a crawler is allowed and meant to index: robots
  // disallows /login and /signup, and /discover + /recommendations are
  // personalised and marked noindex, so none of those belong here. Entries
  // with no real modification date carry none rather than "now".
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/books`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/trending`, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/authors`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/lists`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/clubs`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/community`, changeFrequency: "daily", priority: 0.7 },
    { url: `${baseUrl}/features`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // The anon client: a sitemap is fetched without cookies, and the session
  // client would let an admin's cookie (which can read hidden profiles) change
  // what gets listed.
  const supabase = createPublicClient();

  const [
    { data: books },
    { data: profiles },
    { data: clubs },
    { data: lists },
    authors,
  ] = await Promise.all([
    supabase
      .from("books")
      .select("slug, author_slug, updated_at, created_at")
      .order("ratings_count", { ascending: false, nullsFirst: false })
      .limit(1000),
    // Only readers who opted into discovery, and never a disabled account
    // (the profile page 404s for those).
    supabase
      .from("profiles")
      .select("username, updated_at")
      .not("username", "is", null)
      .eq("discovery_visible", true)
      .is("disabled_at", null)
      .limit(500),
    supabase
      .from("book_clubs")
      .select("slug, updated_at, created_at")
      .eq("visibility", "public")
      .order("member_count", { ascending: false })
      .limit(500),
    supabase
      .from("reading_lists")
      .select("id, updated_at, created_at")
      .eq("visibility", "public")
      .order("likes_count", { ascending: false })
      .limit(500),
    getAllAuthors(),
  ]);

  const bookRows = books ?? [];

  const bookPages: MetadataRoute.Sitemap = bookRows.map((book) => ({
    url: `${baseUrl}/books/${book.slug}`,
    ...lastModified(book.updated_at ?? book.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const userPages: MetadataRoute.Sitemap = (profiles ?? []).map((profile) => ({
    url: `${baseUrl}/users/${profile.username}`,
    ...lastModified(profile.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // An author's page changes when one of their books does, so its date is the
  // newest book date seen in the rows above; authors outside that set get none.
  const authorDates = newest(
    bookRows.map((b) => [b.author_slug, b.updated_at ?? b.created_at] as const)
  );
  const authorPages: MetadataRoute.Sitemap = authors.slice(0, 200).map((author) => ({
    url: `${baseUrl}/authors/${author.slug}`,
    ...lastModified(authorDates.get(author.slug)),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Curated lists are static in code; the ones pinned to explicit book slugs
  // take the newest date among those books.
  const bookDates = new Map(
    bookRows.map((b) => [b.slug, b.updated_at ?? b.created_at] as const)
  );
  const curatedPages: MetadataRoute.Sitemap = CURATED_LISTS.map((list) => {
    const dates = newest(
      (list.bookSlugs ?? []).map((slug) => [list.slug, bookDates.get(slug)] as const)
    );
    return {
      url: `${baseUrl}/lists/${list.slug}`,
      ...lastModified(dates.get(list.slug)),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    };
  });

  const communityListPages: MetadataRoute.Sitemap = (lists ?? []).map((list) => ({
    url: `${baseUrl}/lists/${list.id}`,
    ...lastModified(list.updated_at ?? list.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  const clubPages: MetadataRoute.Sitemap = (clubs ?? []).map((club) => ({
    url: `${baseUrl}/clubs/${club.slug}`,
    ...lastModified(club.updated_at ?? club.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...bookPages,
    ...userPages,
    ...authorPages,
    ...curatedPages,
    ...communityListPages,
    ...clubPages,
  ];
}
