import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for OhMyReads - how we handle your data.",
};

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-12 px-4">
      <article className="prose prose-neutral dark:prose-invert max-w-none">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: December 2024</p>

        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly to us, including:</p>
        <ul>
          <li>
            <strong>Account Information:</strong> Email address, username,
            display name, and profile picture when you create an account.
          </li>
          <li>
            <strong>Content:</strong> Reviews, comments, book lists, and reading
            progress you submit to the Service.
          </li>
          <li>
            <strong>Communications:</strong> Information you provide when you
            contact us for support.
          </li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, maintain, and improve the Service</li>
          <li>Create and manage your account</li>
          <li>Display your reviews and reading activity</li>
          <li>
            Send you technical notices and support messages (you can opt out)
          </li>
          <li>Respond to your comments and questions</li>
          <li>Analyze usage patterns to improve the Service</li>
        </ul>

        <h2>3. Information Sharing</h2>
        <p>We do not sell your personal information. We may share information:</p>
        <ul>
          <li>With your consent</li>
          <li>
            To comply with legal obligations or respond to legal requests
          </li>
          <li>
            To protect the rights, property, or safety of OhMyReads, our users,
            or the public
          </li>
          <li>
            With service providers who assist in operating the Service (e.g.,
            hosting providers)
          </li>
        </ul>

        <h2>4. Data Security</h2>
        <p>
          We implement appropriate technical and organizational measures to
          protect your personal information. However, no method of transmission
          over the Internet is 100% secure, and we cannot guarantee absolute
          security.
        </p>

        <h2>5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Delete your account and data</li>
          <li>Export your data</li>
          <li>Object to processing of your data</li>
        </ul>

        <h2>6. Cookies</h2>
        <p>
          We use cookies and similar technologies to maintain your session,
          remember your preferences, and analyze how the Service is used. You
          can control cookies through your browser settings.
        </p>

        <h2>7. Third-Party Links</h2>
        <p>
          The Service may contain links to third-party websites or services. We
          are not responsible for the privacy practices of these third parties.
        </p>

        <h2>8. Children&apos;s Privacy</h2>
        <p>
          The Service is not directed to children under 13. We do not knowingly
          collect personal information from children under 13. If you believe we
          have collected information from a child, please contact us.
        </p>

        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify
          you of changes by posting the new policy on this page and updating the
          &quot;Last updated&quot; date.
        </p>

        <h2>10. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or how we handle your
          data, please contact us at{" "}
          <a href="mailto:privacy@ohmyreads.com">privacy@ohmyreads.com</a>.
        </p>
      </article>
    </div>
  );
}

