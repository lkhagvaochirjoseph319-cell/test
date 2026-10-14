# Global Affairs AI

A dark, responsive international-relations study desk built with Next.js, TypeScript, and Tailwind CSS. The news desk reads real BBC News, The Guardian, and DW world RSS feeds through a server-side route. Study guides, quizzes, glossary, notes, filters, and saved articles work without an AI account.

## Run locally

You need Node.js 20.9 or later. In this folder, run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). News is fetched from publisher RSS feeds; no news API key is required. If a publisher feed is unavailable, the dashboard reports the partial failure and keeps the other sources visible.

## Enable AI explanations and tutoring

1. Copy `.env.example` to `.env.local`.
2. Add a key from OpenAI to `OPENAI_API_KEY`, leaving `AI_PROVIDER=openai`, or set `AI_PROVIDER=anthropic` and add an Anthropic key to `ANTHROPIC_API_KEY`.
3. Restart the development server.

The optional model settings are `OPENAI_MODEL` and `ANTHROPIC_MODEL`. `.env.local` is ignored by Git. Never put provider keys in a `NEXT_PUBLIC_` variable or commit them.

Without a configured key, the explainer and tutor return a clear setup message; the app does not show invented AI answers. The explainer receives the publisher's RSS title and summary, not the full article. Its only guaranteed citation is the original publisher link. The tutor has no live web access and should not be used as a source for breaking-news verification.

## Updates and editorial limits

The news route caches and revalidates feeds every five minutes when requested. `vercel.json` also configures a 15-minute Vercel Cron request to warm the route after deployment; scheduled jobs require a hosting plan that supports Vercel Cron. The briefing is composed from current feed items when opened, not stored as an archived daily edition.

Region, country, topic, and article-status labels are best-effort keyword signals from publisher headlines and summaries. They are not fact-checks. No story is labeled independently confirmed. Check the original reporting and seek corroboration, especially for allegations and developing reports. News availability and feed terms are controlled by each publisher.