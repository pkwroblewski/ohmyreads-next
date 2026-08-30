import { escapeHtml } from "@/lib/utils/sanitize";

export interface WelcomeEmailProps {
  username: string;
  displayName?: string;
}

export function getWelcomeEmailSubject(): string {
  return "Welcome to OhMyReads! Start your reading journey";
}

export function getWelcomeEmailHtml({ username, displayName }: WelcomeEmailProps): string {
  // Escaped: this is hand-built HTML, so a display name containing markup would
  // otherwise be injected verbatim into the delivered email.
  const name = escapeHtml(displayName || username);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to OhMyReads</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8B5A2B 0%, #D2691E 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; font-family: Georgia, serif;">
                OhMyReads
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">
                Your Personal Reading Journey
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                Welcome, ${name}!
              </h2>

              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                We're thrilled to have you join our community of book lovers. OhMyReads is your personal space to track what you read, discover new books, and connect with fellow readers.
              </p>

              <p style="margin: 0 0 30px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Here's what you can do to get started:
              </p>

              <!-- Feature List -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background-color: #8B5A2B; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 14px;">1</span>
                        </td>
                        <td style="color: #4a4a4a; font-size: 15px;">
                          <strong>Add books to your shelf</strong> - Track what you're reading, have read, or want to read
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background-color: #8B5A2B; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 14px;">2</span>
                        </td>
                        <td style="color: #4a4a4a; font-size: 15px;">
                          <strong>Set reading challenges</strong> - Challenge yourself with monthly or yearly reading goals
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background-color: #8B5A2B; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 14px;">3</span>
                        </td>
                        <td style="color: #4a4a4a; font-size: 15px;">
                          <strong>Import from Goodreads</strong> - Bring your reading history with you
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background-color: #8B5A2B; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 14px;">4</span>
                        </td>
                        <td style="color: #4a4a4a; font-size: 15px;">
                          <strong>Earn badges</strong> - Unlock achievements as you read more
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${siteUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #8B5A2B 0%, #D2691E 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">
                      Go to Your Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px 40px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px; color: #888; font-size: 14px;">
                Happy reading!
              </p>
              <p style="margin: 0 0 20px; color: #888; font-size: 14px;">
                The OhMyReads Team
              </p>
              <p style="margin: 0; color: #aaa; font-size: 12px;">
                <a href="${siteUrl}" style="color: #8B5A2B; text-decoration: none;">ohmyreads.com</a>
              </p>
            </td>
          </tr>

        </table>

        <!-- Unsubscribe -->
        <p style="margin: 20px 0 0; color: #999; font-size: 12px; text-align: center;">
          You're receiving this email because you signed up for OhMyReads.<br>
          <a href="${siteUrl}/settings" style="color: #8B5A2B;">Manage email preferences</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getWelcomeEmailText({ username, displayName }: WelcomeEmailProps): string {
  const name = displayName || username;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  return `
Welcome to OhMyReads, ${name}!

We're thrilled to have you join our community of book lovers. OhMyReads is your personal space to track what you read, discover new books, and connect with fellow readers.

Here's what you can do to get started:

1. Add books to your shelf - Track what you're reading, have read, or want to read
2. Set reading challenges - Challenge yourself with monthly or yearly reading goals
3. Import from Goodreads - Bring your reading history with you
4. Earn badges - Unlock achievements as you read more

Go to your dashboard: ${siteUrl}/dashboard

Happy reading!
The OhMyReads Team

---
You're receiving this email because you signed up for OhMyReads.
Manage email preferences: ${siteUrl}/settings
  `.trim();
}
