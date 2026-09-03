import { notFound } from "next/navigation";
import { getBookBySlug } from "@/lib/queries/books";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Exists only to make a missing book a real 404.
 *
 * `loading.tsx` wraps the page in a Suspense boundary, so by the time the page
 * (or `generateMetadata`, which streams for ordinary browsers and Googlebot)
 * calls `notFound()` the 200 status has already been sent — a soft 404. A
 * layout renders above that boundary. `getBookBySlug` is React-cached, so the
 * page's own call to it costs nothing extra.
 */
export default async function BookLayout({ children, params }: Props) {
  const { slug } = await params;
  if (!(await getBookBySlug(slug))) {
    notFound();
  }
  return children;
}
