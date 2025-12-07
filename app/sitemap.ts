import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

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
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
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
    .order("ratings_count", { ascending: false })
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

  return [...staticPages, ...bookPages, ...userPages];
}

