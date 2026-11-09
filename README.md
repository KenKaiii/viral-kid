# Viral-Kid

Track viral content across Twitter, YouTube, Reddit & Instagram from one dashboard. Monitor trends, manage multiple accounts, and automate replies.

> [!TIP]
> **Want to build your own apps with AI?** A free 7-day build challenge and 20+ step-by-step projects are in my free community: **[skool.com/raid](https://www.skool.com/raid)**

## What It Does

- **Multi-Platform Tracking** - Monitor viral content across Twitter, YouTube, Reddit, and Instagram
- **Account Management** - Connect and manage multiple accounts per platform with OAuth
- **Automated Pipelines** - Set up automated reply workflows with AI-powered responses
- **Trend Discovery** - Track trending topics and viral content in real-time
- **Background Jobs** - Scheduled tasks via BullMQ workers or Vercel cron

## Prerequisites

- Node.js 22+
- Docker (for PostgreSQL and Redis)

## Setup

```bash
# Clone the repository
git clone https://github.com/KenKaiii/viral-kid.git
cd viral-kid

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your database and auth credentials

# Start the database
docker compose up -d

# Run database migrations
npm run db:migrate

# Start the development server
npm run dev
```

Open [localhost:3000](http://localhost:3000) to access the dashboard.

## Tech Stack

- Next.js 16
- React 19
- PostgreSQL
- Prisma
- Redis + BullMQ
- TailwindCSS
- NextAuth

## Author

Built by [Ken](https://github.com/KenKaiii)

- [YouTube](https://www.youtube.com/@kenkaidoesai)
- [Free Skool community](https://www.skool.com/raid): a 7-day build challenge and 20+ step-by-step projects

## License

MIT
