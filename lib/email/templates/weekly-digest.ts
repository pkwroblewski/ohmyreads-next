export interface WeeklyDigestProps {
  username: string;
  displayName?: string;
  stats: {
    booksRead: number;
    pagesRead: number;
    reviewsWritten: number;
    currentStreak: number;
  };
  recentBooks: Array<{
    title: string;
    author: string;
    coverUrl?: string;
  }>;
  friendActivity: Array<{
    username: string;
    action: string;
    bookTitle: string;
  }>;
  challengeProgress?: {
    name: string;
    current: number;
    target: number;
    daysRemaining: number;
  };
}

export function getWeeklyDigestSubject(stats: { booksRead: number }): string {
  if (stats.booksRead > 0) {
    return `Your week in reading: ${stats.booksRead} book${stats.booksRead > 1 ? "s" : ""} completed!`;
  }
  return "Your weekly reading roundup from OhMyReads";
}

export function getWeeklyDigestHtml(props: WeeklyDigestProps): string {
  const { username, displayName, stats, recentBooks, friendActivity, challengeProgress } = props;
  const name = displayName || username;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  const recentBooksHtml = recentBooks.length > 0
    ? recentBooks.map(book => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="width: 50px; vertical-align: top;">
                <img src="${book.coverUrl || `${siteUrl}/book-placeholder.png`}" alt="" width="40" height="60" style="border-radius: 4px; object-fit: cover;">
              </td>
              <td style="padding-left: 12px; vertical-align: top;">
                <p style="margin: 0; font-weight: 600; color: #1a1a1a; font-size: 14px;">${escapeHtml(book.title)}</p>
                <p style="margin: 4px 0 0; color: #666; font-size: 13px;">${escapeHtml(book.author)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `).join("")
    : '<tr><td style="padding: 20px; text-align: center; color: #888;">No books completed this week. Keep reading!</td></tr>';

  const friendActivityHtml = friendActivity.length > 0
    ? friendActivity.slice(0, 5).map(activity => `
      <tr>
        <td style="padding: 8px 0; color: #4a4a4a; font-size: 13px;">
          <strong>${escapeHtml(activity.username)}</strong> ${escapeHtml(activity.action)} <em>${escapeHtml(activity.bookTitle)}</em>
        </td>
      </tr>
    `).join("")
    : '<tr><td style="padding: 12px 0; color: #888; font-size: 13px;">Follow more readers to see their activity!</td></tr>';

  const challengeHtml = challengeProgress ? `
    <tr>
      <td style="padding: 20px; background-color: #fff8f0; border-radius: 8px; margin-top: 20px;">
        <p style="margin: 0 0 10px; font-weight: 600; color: #8B5A2B; font-size: 14px;">
          Challenge: ${escapeHtml(challengeProgress.name)}
        </p>
        <div style="background-color: #e5e5e5; border-radius: 10px; height: 8px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #8B5A2B 0%, #D2691E 100%); height: 100%; width: ${Math.min(100, Math.round((challengeProgress.current / challengeProgress.target) * 100))}%;"></div>
        </div>
        <p style="margin: 8px 0 0; color: #666; font-size: 12px;">
          ${challengeProgress.current} / ${challengeProgress.target} • ${challengeProgress.daysRemaining} days remaining
        </p>
      </td>
    </tr>
  ` : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Reading Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8B5A2B 0%, #D2691E 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold; font-family: Georgia, serif;">
                Your Week in Books
              </h1>
            </td>
          </tr>

          <!-- Stats Banner -->
          <tr>
            <td style="padding: 30px 40px; background-color: #faf8f5;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px;">
                    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #8B5A2B;">${stats.booksRead}</p>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #888; text-transform: uppercase;">Books</p>
                  </td>
                  <td align="center" style="padding: 10px;">
                    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #8B5A2B;">${stats.pagesRead}</p>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #888; text-transform: uppercase;">Pages</p>
                  </td>
                  <td align="center" style="padding: 10px;">
                    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #8B5A2B;">${stats.currentStreak}</p>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #888; text-transform: uppercase;">Day Streak</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 18px; font-weight: 600;">
                Hi ${escapeHtml(name)}!
              </h2>

              <p style="margin: 0 0 25px; color: #4a4a4a; font-size: 15px; line-height: 1.6;">
                Here's your reading activity from the past week.
              </p>

              <!-- Recent Books -->
              <h3 style="margin: 0 0 15px; color: #1a1a1a; font-size: 15px; font-weight: 600;">
                Recently Completed
              </h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
                ${recentBooksHtml}
              </table>

              <!-- Friend Activity -->
              <h3 style="margin: 0 0 15px; color: #1a1a1a; font-size: 15px; font-weight: 600;">
                Friend Activity
              </h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
                ${friendActivityHtml}
              </table>

              <!-- Challenge Progress -->
              ${challengeHtml}

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
                <tr>
                  <td align="center">
                    <a href="${siteUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #8B5A2B 0%, #D2691E 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px;">
                      View Full Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 25px 40px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #888; font-size: 13px;">
                Happy reading!<br>The OhMyReads Team
              </p>
            </td>
          </tr>

        </table>

        <!-- Unsubscribe -->
        <p style="margin: 20px 0 0; color: #999; font-size: 12px; text-align: center;">
          <a href="${siteUrl}/settings" style="color: #8B5A2B;">Manage email preferences</a> •
          <a href="${siteUrl}/settings?unsubscribe=digest" style="color: #888;">Unsubscribe from digests</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getWeeklyDigestText(props: WeeklyDigestProps): string {
  const { username, displayName, stats, recentBooks, friendActivity, challengeProgress } = props;
  const name = displayName || username;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  const recentBooksText = recentBooks.length > 0
    ? recentBooks.map(book => `  - ${book.title} by ${book.author}`).join("\n")
    : "  No books completed this week. Keep reading!";

  const friendActivityText = friendActivity.length > 0
    ? friendActivity.slice(0, 5).map(a => `  - ${a.username} ${a.action} "${a.bookTitle}"`).join("\n")
    : "  Follow more readers to see their activity!";

  const challengeText = challengeProgress
    ? `\nChallenge Progress: ${challengeProgress.name}\n  ${challengeProgress.current}/${challengeProgress.target} • ${challengeProgress.daysRemaining} days remaining\n`
    : "";

  return `
Your Week in Books - OhMyReads

Hi ${name}!

YOUR STATS THIS WEEK
---
Books: ${stats.booksRead}
Pages: ${stats.pagesRead}
Reviews: ${stats.reviewsWritten}
Streak: ${stats.currentStreak} days

RECENTLY COMPLETED
---
${recentBooksText}

FRIEND ACTIVITY
---
${friendActivityText}
${challengeText}
---

View your full dashboard: ${siteUrl}/dashboard

Happy reading!
The OhMyReads Team

---
Manage email preferences: ${siteUrl}/settings
Unsubscribe from digests: ${siteUrl}/settings?unsubscribe=digest
  `.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
