import { Metadata } from "next";
import Link from "next/link";
import { LEGAL_ARTICLE_CLASS } from "@/components/legal/legal-article-class";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for OhMyReads - what we collect, which services process it, and the controls you have.",
};

/**
 * Written from the code, not from a template: every processor named below is
 * a dependency in package.json or a host called from lib/, app/api/ or the
 * Sentry config. Keep this page in step with those when a service is added or
 * removed. Reviewed against the codebase on the "Last updated" date.
 */

const LAST_UPDATED = "3 September 2026";

type Processor = {
  name: string;
  purpose: string;
  data: string;
  when: string;
};

const PROCESSORS: Processor[] = [
  {
    name: "Supabase",
    purpose: "Database, authentication, file storage",
    data: "Everything in section 1: account, profile, library, reviews, messages, location, uploaded photos",
    when: "Always",
  },
  {
    name: "Vercel",
    purpose: "Hosting, server functions, image optimisation",
    data: "Every request, including IP address, user agent and the pages you open",
    when: "Always",
  },
  {
    name: "Sentry",
    purpose: "Error reporting and performance monitoring",
    data: "Stack traces, request URLs, browser and device details; a sample of browser sessions is replayed with all text masked and media blocked",
    when: "Always (1% of sessions are sampled for replay, plus any session that hits an error)",
  },
  {
    name: "Resend",
    purpose: "Transactional email",
    data: "Email address, display name, and the contents of the welcome email and weekly digest (books finished, pages, streak, challenge progress, friend activity)",
    when: "On sign-up, and weekly while the digest is switched on",
  },
  {
    name: "Google",
    purpose:
      "Sign in with Google; Google Books catalog search; Google Places details for literary places; Gemini models for AI features",
    data: "Sign-in: your Google account email and name. Books: the search text you type. Places: the name and coordinates of a place being added. Gemini: see section 4",
    when: "Only when you use the related feature",
  },
  {
    name: "OpenAI, Anthropic",
    purpose: "Alternative model providers for the AI features",
    data: "The same prompts described in section 4",
    when: "Only if the site is configured to use them instead of Gemini",
  },
  {
    name: "Mapbox",
    purpose: "Map tiles, geocoding, directions, travel-time areas",
    data: "Your browser loads map tiles directly from Mapbox (so Mapbox sees your IP address); the server sends coordinates for directions and travel-time requests",
    when: "Only on map pages and the location card in settings",
  },
  {
    name: "ipapi.co",
    purpose: "Approximate location from IP address",
    data: "Your IP address",
    when: "Only when the reader map needs a starting point and you have not shared a location",
  },
  {
    name: "OpenStreetMap (Nominatim, Overpass)",
    purpose: "Place search and nearby bookshops, libraries and cafes",
    data: "The place name you type and the map area or coordinates being searched",
    when: "Only on map and place-search features",
  },
  {
    name: "Open Library, Google Books, archive.org",
    purpose: "Book metadata and cover images",
    data: "Search text for catalog lookups. Cover images are fetched by our server-side image optimiser, so these hosts see our server, not your browser",
    when: "Catalog searches and whenever a book cover is shown",
  },
];

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-12 px-4">
      <article className={LEGAL_ARTICLE_CLASS}>
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: {LAST_UPDATED}</p>

        <p>
          OhMyReads is a book tracking and reading community site. This policy
          describes what we actually collect, which services process it, and
          the controls you have. It is written from how the site works today
          and is updated whenever that changes.
        </p>

        <h2>1. Information We Collect</h2>

        <h3>Account</h3>
        <ul>
          <li>
            <strong>Credentials:</strong> Email address and a password, or the
            email and name from your Google account if you sign in with Google.
            Passwords are stored hashed by our authentication provider; we never
            see them.
          </li>
          <li>
            <strong>Profile:</strong> Username, display name, avatar URL, bio,
            website and social links, favourite genres and reading preferences
            (your taste profile).
          </li>
        </ul>

        <h3>Reading activity</h3>
        <ul>
          <li>
            Books on your shelves, their status (want to read, reading, read),
            start and finish dates, page progress, ratings, custom shelves and
            reading lists, reading challenges and goals, and computed statistics
            such as pages read and streaks.
          </li>
          <li>
            Reviews, comments, likes, check-ins, book and place submissions,
            and any photos you upload for a literary place.
          </li>
          <li>
            Social graph: who you follow, friend requests, club memberships,
            and direct messages you exchange with other readers. Messages are
            stored so both participants can read them; they are not end-to-end
            encrypted.
          </li>
        </ul>

        <h3>Location and presence (optional)</h3>
        <p>
          Location features are off by default. If you switch them on in{" "}
          <Link href="/settings">Settings</Link>, we store:
        </p>
        <ul>
          <li>
            A <strong>coarsened location</strong>: your position is converted to
            a geohash at the precision you choose (city area, about 20 km;
            district, about 2.4 km; or neighbourhood, about 1.2 km). The exact
            coordinates from your browser are not stored. A text label for the
            place (for example a town name) is stored alongside it.
          </li>
          <li>
            A <strong>presence check-in</strong>, if you make one: the type
            (temporary or recommended), an optional short note, an expiry time,
            and the geohash of the place you checked in at, at the precision of
            that place.
          </li>
        </ul>
        <p>
          Other readers only ever see the coarsened location. Turning location
          sharing off deletes the stored geohash and label. See section 6 for
          who can see this.
        </p>

        <h3>Collected automatically</h3>
        <ul>
          <li>
            <strong>Request data:</strong> IP address, user agent, pages
            requested, and timestamps, in hosting logs and error reports.
          </li>
          <li>
            <strong>Rate-limit counters</strong> keyed by IP address or user ID,
            kept briefly in memory or in a Redis store to stop abuse.
          </li>
          <li>
            <strong>Audit records</strong> of security-relevant actions on your
            account (password change, account deletion, moderation decisions)
            with the acting user ID, the action, and the time. We do not record
            IP addresses in this log.
          </li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To run your account, shelves, statistics and challenges.</li>
          <li>
            To display your public profile, reviews and activity to other
            readers and, for public content, to search engines.
          </li>
          <li>To generate recommendations and other AI features (section 4).</li>
          <li>
            To show you on the reader map and in nearby-reader discovery, only
            when you have opted in (section 6).
          </li>
          <li>To send a welcome email and an optional weekly digest (section 5).</li>
          <li>To moderate reported content and keep the service secure.</li>
          <li>
            To find and fix errors. We do not run product analytics or
            advertising trackers.
          </li>
        </ul>

        <h2>3. Services That Process Your Data</h2>
        <p>
          We do not sell personal data. The following providers process it on
          our behalf. &quot;Always&quot; means the service is part of running
          the site; the rest are only contacted when you use the related
          feature.
        </p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Purpose</th>
                <th>What it receives</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map((p) => (
                <tr key={p.name}>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td>{p.purpose}</td>
                  <td>{p.data}</td>
                  <td>{p.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          We may also disclose information to comply with the law, to respond
          to a lawful request, or to protect the rights and safety of
          OhMyReads, its users or the public.
        </p>

        <h2>4. AI Features</h2>
        <p>
          Some features send text to a large language model provider (Google
          Gemini by default; OpenAI or Anthropic if the site is configured to
          use them). What is sent depends on the feature:
        </p>
        <ul>
          <li>
            <strong>Book search assistant:</strong> the messages you type in the
            chat.
          </li>
          <li>
            <strong>Curated picks:</strong> your taste profile (preferred genres,
            vibes, pace and length) and the titles, authors and ratings of your
            recent books, together with the candidate book being described.
            Your name and username are not included.
          </li>
          <li>
            <strong>Trending insights:</strong> short excerpts of public reviews
            for trending books, without reviewer names.
          </li>
          <li>
            <strong>Place search assistant:</strong> the messages you type and
            the coordinates you supply for the search.
          </li>
        </ul>
        <p>
          Prompts are sent per request and we do not store them; the provider
          handles them under its own API terms. AI output is not stored against
          your profile except where it is shown on the page.
        </p>

        <h2>5. Email</h2>
        <p>
          We send one welcome email when you sign up and, if enabled, a weekly
          reading digest. The digest can be switched off in{" "}
          <Link href="/settings">Settings</Link>, and every digest carries a
          one-click unsubscribe link that works without signing in. We do not
          send marketing email.
        </p>

        <h2>6. What Other People Can See</h2>
        <ul>
          <li>
            <strong>Public:</strong> your username, display name, avatar, bio,
            website and social links, join date, follower counts, public
            reviews, comments, reading lists and reading activity. Signed-out
            visitors and search engines can read these.
          </li>
          <li>
            <strong>Only you:</strong> your email address, location settings and
            precision, presence check-in details, email preferences, and the
            full contents of your direct messages (shared with the other
            participant only). Database rules enforce this, not just the user
            interface.
          </li>
          <li>
            <strong>Discovery:</strong> the &quot;visible in discovery&quot;
            switch in Settings controls whether you appear on discovery pages,
            in nearby-reader results and in recommendations. Your coarsened
            location is shown on the reader map only while you have location
            sharing on, discovery on, and an active check-in.
          </li>
          <li>
            <strong>Administrators</strong> can see reported content, moderation
            queues and your profile fields to handle reports and abuse.
          </li>
        </ul>

        <h2>7. Cookies and Local Storage</h2>
        <p>
          We use cookies only to keep you signed in (session tokens set by our
          authentication provider). Your light or dark theme choice is kept in
          your browser local storage. There are no advertising or analytics
          cookies.
        </p>

        <h2>8. Retention and Deletion</h2>
        <ul>
          <li>Your data is kept for as long as your account exists.</li>
          <li>
            You can delete your account at any time from{" "}
            <Link href="/settings">Settings</Link>. Deletion removes your
            account, profile, shelves, reviews, comments, lists, messages,
            check-ins, uploaded place photos and email preferences. It is
            immediate and cannot be undone.
          </li>
          <li>
            A few records are kept without your identity after deletion:
            reports you filed and moderation decisions you made stay with the
            reporter or moderator reference cleared, and security audit entries
            remain so we can investigate abuse.
          </li>
          <li>
            Hosting logs and error reports are kept by Vercel and Sentry for the
            limited periods set by those providers, then discarded.
          </li>
          <li>
            Turning location sharing off deletes your stored location
            immediately, independent of account deletion.
          </li>
        </ul>

        <h2>9. Your Rights</h2>
        <p>
          Depending on where you live you may have the right to access,
          correct, export, delete or object to the processing of your personal
          data. Most of these are self-service:
        </p>
        <ul>
          <li>
            <strong>Access and correct:</strong> edit your{" "}
            <Link href="/profile/edit">profile</Link> and{" "}
            <Link href="/settings">settings</Link>.
          </li>
          <li>
            <strong>Export:</strong> download your library, reviews, taste
            profile and challenges as a file from{" "}
            <Link href="/settings">Settings</Link>.
          </li>
          <li>
            <strong>Delete:</strong> use the account deletion control in{" "}
            <Link href="/settings">Settings</Link>.
          </li>
          <li>
            <strong>Object or ask questions:</strong> email us (section 12).
          </li>
        </ul>

        <h2>10. Data Security</h2>
        <p>
          Data is encrypted in transit, access to it is restricted by
          row-level rules in the database, and we log security-relevant
          actions. No method of storage or transmission is completely secure,
          so we cannot guarantee absolute security. If we learn of a breach
          that affects you, we will tell you.
        </p>

        <h2>11. Children&apos;s Privacy</h2>
        <p>
          The Service is not directed to children under 13, and we do not
          knowingly collect personal information from them. If you believe a
          child has created an account, contact us and we will delete it.
        </p>

        <h2>12. Contact</h2>
        <p>
          Questions about this policy or your data:{" "}
          <a href="mailto:privacy@ohmyreads.com">privacy@ohmyreads.com</a>.
        </p>

        <h2>13. Changes to This Policy</h2>
        <p>
          When our data practices change we update this page and the
          &quot;Last updated&quot; date. Material changes are also announced on
          the site.
        </p>
      </article>
    </div>
  );
}
