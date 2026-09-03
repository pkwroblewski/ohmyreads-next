import { Metadata } from "next";
import Link from "next/link";
import { LEGAL_ARTICLE_CLASS } from "@/components/legal/legal-article-class";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for OhMyReads - the book tracking platform.",
};

const LAST_UPDATED = "3 September 2026";

export default function TermsPage() {
  return (
    <div className="container max-w-3xl py-12 px-4">
      <article className={LEGAL_ARTICLE_CLASS}>
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: {LAST_UPDATED}</p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing and using OhMyReads (&quot;the Service&quot;), you agree
          to be bound by these Terms of Service and to our{" "}
          <Link href="/privacy">Privacy Policy</Link>. If you do not agree to
          these terms, please do not use the Service.
        </p>

        <h2>2. Description of Service</h2>
        <p>
          OhMyReads is a book tracking platform that allows users to catalog
          books, write reviews, track reading progress, discover literary
          places, and connect with other readers. The Service is provided free
          of charge. We may change or discontinue features at any time.
        </p>

        <h2>3. User Accounts</h2>
        <p>
          To use certain features of the Service, you must create an account
          with an email address and password or with a Google account. You must
          be at least 13 years old. You are responsible for maintaining the
          confidentiality of your account credentials and for all activities
          that occur under your account. One person may not operate multiple
          accounts to evade moderation.
        </p>

        <h2>4. User Content</h2>
        <p>
          You retain ownership of all content you submit to the Service,
          including reviews, comments, reading lists, messages, place
          submissions, photos and profile information. By submitting content,
          you grant OhMyReads a non-exclusive, worldwide, royalty-free license
          to store, display, distribute and adapt it for the purpose of
          operating the Service, including showing public content to
          signed-out visitors and search engines. This license ends when you
          delete the content or your account, except for the anonymised
          records described in the Privacy Policy.
        </p>
        <p>
          You are responsible for what you post. Only submit content you have
          the right to share, and only upload photos of places that you took
          or are permitted to use.
        </p>

        <h2>5. Moderation and Reports</h2>
        <p>
          Any reader can report a review, a comment or a place photo.
          Reports are reviewed by administrators, who may hide or remove
          content, decline a book or place submission, or disable an account.
          We act on reports in good faith and do not guarantee a particular
          outcome or response time. A disabled account is signed out, its
          public profile and content are hidden, and it cannot sign back in
          until it is re-enabled. If you believe a moderation decision was
          wrong, contact us (section 14).
        </p>

        <h2>6. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Post illegal, harmful, hateful or harassing content</li>
          <li>Harass, abuse, threaten or stalk other users</li>
          <li>Impersonate others or misrepresent your identity</li>
          <li>Spam, post unauthorized commercial content, or file false reports</li>
          <li>
            Post another person&apos;s private information, including their
            location
          </li>
          <li>
            Scrape, crawl or bulk-download content, or circumvent rate limits
          </li>
          <li>
            Attempt to gain unauthorized access to the Service or other accounts
          </li>
          <li>Use the Service for any illegal purpose</li>
        </ul>

        <h2>7. AI-Generated Content</h2>
        <p>
          Some features of the Service, including the book search assistant,
          curated picks, trending insights and the place search assistant, use
          third-party large language models to generate text. This output is
          produced automatically and may be inaccurate, incomplete or
          out of date. Recommendations and descriptions are not endorsements,
          and we do not guarantee that a recommended book or place exists,
          is available, or matches its description. Use your own judgment
          before relying on it. The Privacy Policy describes what is sent to
          the model provider.
        </p>

        <h2>8. Location Features</h2>
        <p>
          Location sharing, the reader map, check-ins and nearby-reader
          discovery are optional and off by default. When you enable them, you
          choose how precise your shared location is, and only that coarsened
          location is ever shown to other readers. You may turn location
          sharing off at any time in <Link href="/settings">Settings</Link>,
          which deletes the stored location. Do not use location features to
          track, follow or harass another reader. Directions, travel times and
          place details come from third-party map providers and may be
          inaccurate; check them before you set out.
        </p>

        <h2>9. Book and Place Data</h2>
        <p>
          Book metadata, cover images and ratings from outside the Service come
          from third-party catalogs such as Open Library and Google Books, and
          place details from OpenStreetMap, Mapbox and Google. We do not
          control this data and cannot guarantee its accuracy. Ratings shown
          as coming from OhMyReads readers are computed only from reviews on
          this site. Books you add from those catalogs appear immediately;
          manually submitted books and places are reviewed by administrators
          before they appear and may be declined or edited.
        </p>

        <h2>10. Intellectual Property</h2>
        <p>
          The Service, including its original content, design, features and
          functionality, is owned by OhMyReads and protected by copyright,
          trademark and other laws. Third-party book covers, catalog data and
          map tiles remain the property of their respective owners.
        </p>

        <h2>11. Termination</h2>
        <p>
          We may disable or delete your account at any time for violations of
          these terms. You may delete your account at any time from{" "}
          <Link href="/settings">Settings</Link>; deletion is immediate and
          permanent, and removes your content as described in the Privacy
          Policy.
        </p>

        <h2>12. Disclaimer of Warranties</h2>
        <p>
          The Service is provided &quot;as is&quot; without warranties of any
          kind. We do not guarantee that the Service will be uninterrupted,
          secure, or error-free, or that any content, including AI-generated
          content and third-party data, is accurate.
        </p>

        <h2>13. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, OhMyReads shall not be liable
          for any indirect, incidental, special, or consequential damages
          arising from your use of the Service, from reliance on AI-generated
          or third-party content, or from your use of location features.
        </p>

        <h2>14. Contact</h2>
        <p>
          If you have any questions about these Terms of Service, please contact
          us at{" "}
          <a href="mailto:support@ohmyreads.com">support@ohmyreads.com</a>.
        </p>

        <h2>15. Changes to Terms</h2>
        <p>
          We may update these terms from time to time. We will notify users of
          significant changes by posting a notice on the Service or sending an
          email, and by updating the &quot;Last updated&quot; date above.
        </p>
      </article>
    </div>
  );
}
