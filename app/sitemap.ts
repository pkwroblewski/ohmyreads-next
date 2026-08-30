import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAllAuthors } from "@/lib/queries/authors";
import { CURATED_LISTS } from "@/lib/data/curated-lists";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/books`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/authors`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/lists`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/features`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Dynamic book pages
  const supabase = await createClient();

  const { data: books } = await supabase
    .from("books")
    .select("slug, created_at")
    .order("ratings_count", { ascending: false, nullsFirst: false })
    .limit(1000);

  const bookPages: MetadataRoute.Sitemap = (books || []).map((book) => ({
    url: `${baseUrl}/books/${book.slug}`,
    lastModified: new Date(book.created_at || new Date()),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Dynamic user profile pages (public profiles)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username, updated_at")
    .not("username", "is", null)
    .limit(500);

  const userPages: MetadataRoute.Sitemap = (profiles || []).map((profile) => ({
    url: `${baseUrl}/users/${profile.username}`,
    lastModified: new Date(profile.updated_at || new Date()),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Author pages
  const authors = await getAllAuthors();
  const authorPages: MetadataRoute.Sitemap = authors.slice(0, 200).map((author) => ({
    url: `${baseUrl}/authors/${author.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Curated list pages
  const listPages: MetadataRoute.Sitemap = CURATED_LISTS.map((list) => ({
    url: `${baseUrl}/lists/${list.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...bookPages, ...userPages, ...authorPages, ...listPages];
}

