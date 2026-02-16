# viral-kid

A Next.js application for tracking viral content across social platforms (Twitter, YouTube, Reddit, Instagram) with automated reply pipelines and PostgreSQL storage.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   │   ├── auth/           # NextAuth.js authentication
│   │   ├── cron/           # Vercel cron job endpoints
│   │   ├── twitter/        # Twitter OAuth & operations
│   │   ├── youtube/        # YouTube OAuth & operations
│   │   ├── reddit/         # Reddit OAuth & operations
│   │   ├── instagram/      # Instagram OAuth & operations
│   │   ├── openrouter/     # AI model integration
│   │   └── accounts/       # Account management
│   ├── login/              # Login page
│   └── page.tsx            # Main dashboard
├── components/             # React components
│   └── ui/                 # Reusable UI elements
├── lib/                    # Utilities and helpers
│   ├── jobs/               # BullMQ job queue system
│   ├── twitter/            # Twitter API client
│   └── youtube/            # YouTube API client
├── types/                  # TypeScript type definitions
└── generated/              # Auto-generated Prisma client (do not edit)

prisma/                     # Database schema and migrations
.claude/commands/           # Claude Code slash commands
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
- `AUTH_SECRET` - NextAuth.js session encryption (generate with `openssl rand -base64 32`)

Optional (platform-specific credentials stored per-account in database):

- `REDIS_URL` - Redis connection string (default: `redis://localhost:6379`)
- `CRON_SECRET` - Vercel cron authentication

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

- `/api/cron/twitter-automation` - Hourly
- `/api/cron/youtube-trends` - Every 2 hours
- `/api/cron/cleanup` - Daily at 3 AM

Set `CRON_SECRET` in Vercel environment variables for authentication.
