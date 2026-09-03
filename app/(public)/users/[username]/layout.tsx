import { notFound } from "next/navigation";
import { getProfileByUsername } from "@/lib/queries/users";

interface Props {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}

/**
 * Exists only to make a missing profile a real 404.
 *
 * `loading.tsx` wraps the page in a Suspense boundary, so by the time the page
 * (or `generateMetadata`, which streams for ordinary browsers and Googlebot)
 * calls `notFound()` the 200 status has already been sent — a soft 404. A
 * layout renders above that boundary. `getProfileByUsername` is React-cached,
 * so the page's own call (and the followers / following pages') costs nothing
 * extra.
 */
export default async function ProfileLayout({ children, params }: Props) {
  const { username } = await params;
  if (!(await getProfileByUsername(username))) {
    notFound();
  }
  return children;
}
