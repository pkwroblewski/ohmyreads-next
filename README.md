This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Authentication Setup

### Supabase Configuration

1. **URL Configuration** (Authentication → URL Configuration):
   - Site URL: `https://ohmyreads-next.vercel.app`
   - Redirect URLs: `https://ohmyreads-next.vercel.app/callback`

2. **Google Provider** (Authentication → Providers → Google):
   - Enable Google provider
   - Add Client ID and Client Secret from Google Cloud Console

### Google Cloud Console

1. Create OAuth 2.0 Client ID (APIs & Services → Credentials)
2. Add authorized redirect URI: `https://bgczdbmqievfilvdzlgl.supabase.co/auth/v1/callback`
3. **Important**: OAuth consent screen → Either:
   - Publish the app (allows any Google account), OR
   - Add test users manually (Testing mode)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
