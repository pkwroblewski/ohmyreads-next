import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for OhMyReads - the book tracking platform.",
};

export default function TermsPage() {
  return (
    <div className="container max-w-3xl py-12 px-4">
      <article className="prose prose-neutral dark:prose-invert max-w-none">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: December 2024</p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing and using OhMyReads (&quot;the Service&quot;), you agree
          to be bound by these Terms of Service. If you do not agree to these
          terms, please do not use the Service.
        </p>

        <h2>2. Description of Service</h2>
        <p>
          OhMyReads is a book tracking platform that allows users to catalog
          books, write reviews, track reading progress, and connect with other
          readers. The Service is provided free of charge.
        </p>

        <h2>3. User Accounts</h2>
        <p>
          To use certain features of the Service, you must create an account.
          You are responsible for maintaining the confidentiality of your
          account credentials and for all activities that occur under your
          account.
        </p>

        <h2>4. User Content</h2>
        <p>
          You retain ownership of all content you submit to the Service,
          including reviews, comments, and profile information. By submitting
          content, you grant OhMyReads a non-exclusive, worldwide, royalty-free
          license to use, display, and distribute your content on the platform.
        </p>

        <h2>5. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Post illegal, harmful, or offensive content</li>
          <li>Harass, abuse, or threaten other users</li>
          <li>Impersonate others or misrepresent your identity</li>
          <li>Spam or post unauthorized commercial content</li>
          <li>
            Attempt to gain unauthorized access to the Service or other accounts
          </li>
          <li>Use the Service for any illegal purpose</li>
        </ul>

        <h2>6. Intellectual Property</h2>
        <p>
          The Service, including its original content, features, and
          functionality, is owned by OhMyReads and protected by copyright,
          trademark, and other laws.
        </p>

        <h2>7. Termination</h2>
        <p>
          We may terminate or suspend your account at any time for violations of
          these terms. You may also delete your account at any time through your
          account settings.
        </p>

        <h2>8. Disclaimer of Warranties</h2>
        <p>
          The Service is provided &quot;as is&quot; without warranties of any
          kind. We do not guarantee that the Service will be uninterrupted,
          secure, or error-free.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, OhMyReads shall not be liable
          for any indirect, incidental, special, or consequential damages
          arising from your use of the Service.
        </p>

        <h2>10. Changes to Terms</h2>
        <p>
          We may update these terms from time to time. We will notify users of
          significant changes by posting a notice on the Service or sending an
          email.
        </p>

        <h2>11. Contact</h2>
        <p>
          If you have any questions about these Terms of Service, please contact
          us at{" "}
          <a href="mailto:support@ohmyreads.com">support@ohmyreads.com</a>.
        </p>
      </article>
    </div>
  );
}

