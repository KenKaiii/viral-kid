# viral-kid

A Next.js application integrating Twitter and YouTube APIs for analyzing and tracking viral content, with PostgreSQL storage via Prisma.

## Project Structure

```
src/
├── app/           # Next.js App Router (pages, layouts, API routes)
│   └── api/cron/  # Vercel cron job endpoints
├── lib/           # Utilities (db, env, twitter, youtube clients)
│   └── jobs/      # BullMQ job queues and workers
└── generated/     # Auto-generated Prisma client (do not edit)

prisma/            # Database schema and migrations
public/            # Static assets
.claude/commands/  # Claude Code slash commands
```

## Organization Rules

**Keep code organized and modularized:**

- API routes → `src/app/api/`, one file per route/resource
- Components → `src/components/`, one component per file
- Utilities → `src/lib/`, grouped by functionality
- Types → `src/types/` or co-located with usage

**Modularity principles:**

- Single responsibility per file
- Clear, descriptive file names
- Group related functionality together
- Avoid monolithic files

## Code Quality - Zero Tolerance

After editing ANY file, run:

```bash
npm run check
```

This runs typecheck + lint + format checks. Fix ALL errors before continuing.

Individual commands:

```bash
npm run typecheck    # TypeScript check
npm run lint         # ESLint (auto-fix)
npm run format       # Prettier (auto-fix)
```

## Database

```bash
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
```

## Environment Variables

Required in `.env`:

- `DATABASE_URL` - PostgreSQL connection string
- `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`, `TWITTER_BEARER_TOKEN`
- `YOUTUBE_API_KEY`

Optional (for scheduled jobs):

- `REDIS_URL` - Redis connection string (default: `redis://localhost:6379`)
- `CRON_SECRET` - Secret for Vercel cron authentication

## Dev Server

```bash
npm run dev
```

Uses Turbopack for fast refresh. Read terminal output for errors.

## Scheduled Jobs

Two options for running scheduled tasks:

### Option 1: BullMQ Worker (self-hosted)

Requires Redis. Run the worker process alongside your app:

```bash
npm run worker        # Production
npm run worker:dev    # Development (with watch mode)
```

Jobs are defined in `src/lib/jobs/`. Add new job types in:

- `types.ts` - Job data interfaces
- `processors.ts` - Job handler functions
- `queues.ts` - Queue scheduling

### Option 2: Vercel Cron (serverless)

Configured in `vercel.json`. Cron endpoints in `src/app/api/cron/`:

- `/api/cron/twitter-trends` - Hourly
- `/api/cron/youtube-trends` - Every 2 hours
- `/api/cron/cleanup` - Daily at 3 AM

Set `CRON_SECRET` in Vercel environment variables for authentication.
