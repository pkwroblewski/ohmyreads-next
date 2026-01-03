import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/my-shelf",
          "/profile",
          "/profile/edit",
          "/settings",
          "/api/",
          "/auth/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

