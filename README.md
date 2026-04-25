# KAIRAT × SNICKERS — Telegram Mini App MVP

> A production-style MVP for a branded digital collectible card game built around FC Kairat and Snickers.

---
# Deploy

Link to deploy: https://t.me/KairatSnickersBot/kairat

## Product Concept

**KAIRAT × SNICKERS** turns physical SNICKERS packaging into a digital football card game experience inside Telegram. Users collect FC Kairat player cards, battle friends, create custom anime-style players, and play a penalty AR mini-game — all linked to SNICKERS QR code redemptions that bypass cooldowns and restore card energy.

The mechanic is simple but addictive:
- **Collect** → FC Kairat digital cards with stats and rarities
- **Battle** → 1v1 or 3v3 PvP card duels (async MVP, WebSocket-ready)
- **Create** → Build a custom player character with dominant attributes
- **Play** → AR-inspired penalty shooter with timed cooldowns
- **Scan** → SNICKERS QR bypasses cooldowns and restores exhausted cards

---

## MVP Features

| Module | Status |
|--------|--------|
| Telegram WebApp SDK integration | ✅ |
| User auth via Telegram identity | ✅ |
| FC Kairat digital card collection | ✅ |
| Card energy & cooldown system | ✅ |
| 1v1 and 3v3 battle engine | ✅ |
| Battle result narratives | ✅ |
| Friend challenge + deep link sharing | ✅ |
| Custom player character creator | ✅ |
| AR-inspired penalty shooter | ✅ |
| SNICKERS QR redemption flow (mocked) | ✅ |
| Global XP leaderboard | ✅ |
| XP / coins / level progression | ✅ |
| Campaign stats tracking | ✅ |
| Dark premium mobile-first UI | ✅ |
| Seed data for instant demo | ✅ |

---

## Tech Stack

- **Frontend**: Next.js 15 App Router, TypeScript, Tailwind CSS
- **Animation**: Framer Motion
- **State**: Zustand (persisted)
- **Data fetching**: TanStack Query
- **Validation**: Zod
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: Telegram WebApp identity (demo mode available)

---

## Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL running locally (or use a hosted DB like Supabase/Neon)

### Steps

```bash
# 1. Install dependencies
cd kairat-app
npm install

# 2. Configure environment
# The project ships with a pre-filled .env for local dev.
# Only edit it if your Postgres credentials differ from the defaults:
#   DATABASE_URL="postgresql://postgres:password@localhost:5432/kairat_app"
# If you need a fresh copy: cp .env.example .env

# 3. Create the database (run once)
# Make sure PostgreSQL is running, then:
npm run db:push      # pushes schema to DB (no migration files needed for MVP)
npm run db:seed      # seeds FC Kairat cards, demo users, promo codes

# 4. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> **Demo mode**: Set `NEXT_PUBLIC_DEMO_MODE=true` in `.env` to bypass Telegram auth and use the seeded demo user.

### What you need to set up manually

| Thing | Required? | Notes |
|-------|-----------|-------|
| **PostgreSQL 14+** | ✅ Yes | Local install, Docker, Supabase, or Neon all work. Update `DATABASE_URL` in `.env` if your credentials differ from the defaults |
| **Node.js 18+** | ✅ Yes | Required by Next.js 15 |
| **Telegram Bot** | ❌ Not for local dev | `NEXT_PUBLIC_DEMO_MODE=true` (already set) skips auth entirely |
| **Telegram Bot (production)** | ✅ When deploying | Create via [@BotFather](https://t.me/BotFather), enable Mini Apps, set your deployed domain as the Mini App URL, add `TELEGRAM_BOT_TOKEN` to production env |
| **Anything else** | ❌ No | No external APIs, no Stripe, no S3 — everything runs locally |

> **TL;DR for local dev:** PostgreSQL running + `npm run db:push && npm run db:seed` — that's all you need.


### Database reset (fresh seed)

```bash
npm run db:reset
```

### Prisma Studio (DB browser)

```bash
npm run db:studio
```

---

## Demo QR Codes

Use these codes on the `/scan` page to test redemptions:

| Code | Reward |
|------|--------|
| `SNICKERS-KAIRAT-2024` | Card energy restore |
| `MARS-FC-ALPHA` | AR cooldown bypass |
| `GOLD-BAR-001` | +100 coins |
| `GOLD-BAR-002` | +100 coins |
| `GOLD-BAR-003` | +150 coins |
| `KAIRAT-BOOST-XP` | +200 XP |
| `SNICKERS-DEMO-01` | Card energy restore |
| `SNICKERS-DEMO-02` | Card energy restore |
| `BYPASS-NOW` | AR cooldown bypass |

---

## Project Structure

```
src/
├── app/
│   ├── api/              # Route handlers
│   │   ├── ar/           # AR session endpoint
│   │   ├── battle/       # Battle engine endpoint
│   │   ├── cards/        # Card collection
│   │   ├── challenge/    # Friend challenges
│   │   ├── character/    # Character creator
│   │   ├── leaderboard/  # XP rankings
│   │   ├── scan/         # QR redemption
│   │   └── user/init/    # Auth + profile init
│   ├── ar/               # AR penalty mode page
│   ├── battle/           # Battle setup + result
│   ├── cards/            # Collection + card detail
│   ├── character/        # Character creator
│   ├── leaderboard/      # Global rankings
│   ├── profile/          # User profile
│   ├── scan/             # QR scan page
│   └── page.tsx          # Home dashboard
├── components/
│   ├── cards/            # PlayerCard component
│   ├── ui/               # Shared UI primitives
│   ├── BottomNav.tsx
│   └── Providers.tsx
├── config/
│   └── game.ts           # Economy, battle, AR config
├── lib/
│   ├── battle/engine.ts  # Battle resolution logic
│   ├── db.ts             # Prisma singleton
│   ├── telegram.ts       # WebApp SDK wrapper
│   └── utils.ts          # Shared utilities
├── store/
│   └── index.ts          # Zustand stores
└── types/
    └── index.ts          # Domain types
prisma/
├── schema.prisma         # Full DB schema
└── seed.ts               # Demo data seed
```

---

## Battle Engine

The battle engine (`src/lib/battle/engine.ts`) is deterministic-but-fun:

1. **Stat weighting** — each card's stats are weighted differently by position role (attacker/defender/GK/generic)
2. **Rarity multiplier** — Legendary cards get a 25% power boost
3. **Energy penalty** — cards below 30% energy perform at 85% effectiveness
4. **Random variance** — ±15% controlled randomness keeps outcomes exciting
5. **Team synergy** — 3v3 same-club teams get a 5% bonus
6. **Narrative result** — outcome is mapped to a football-themed result (GOAL, SAVE, COUNTER, etc.)

All weights and economy values are in `src/config/game.ts` — fully tunable without code changes.

---

## Future Roadmap

### Phase 2 — Technical
- **Live PvP**: Replace async battle engine with WebSocket rooms (Socket.io or Ably)
- **Real QR scanner**: Integrate `@zxing/library` or native camera API for true QR scanning
- **AI anime avatar**: Connect to Replicate or Stable Diffusion API for generated character art
- **True AR goalkeeper**: Use WebXR or 8th Wall SDK for real surface-anchored AR

### Phase 3 — Product
- **Seasonal FC Kairat drops**: Limited-edition card releases tied to match results or tournaments
- **Collectible rarity economy**: Card trading, auctions, and pack opening mechanics
- **Retailer campaign analytics**: Dashboard for MARS team to track QR scans by SKU/region/store
- **Anti-fraud system**: Rate limiting, one-time code validation, device fingerprinting
- **Moderation panel**: Admin UI for managing campaigns, cards, and users
- **Streak rewards**: Daily login bonuses, weekly challenge events
- **Club/guild system**: Create squads, compete in league tables

### Phase 4 — Scale
- **Multi-brand expansion**: Extend mechanic to other MARS brands (TWIX, BOUNTY, M&Ms)
- **Regional localisation**: Kazakh language, CIS market expansion
- **Partnership API**: Allow retailers to create custom promo code batches
- **Esports integration**: Live FC Kairat match results trigger in-game events

---

## Branding Notes

- **Primary palette**: FC Kairat yellow `#F5C518` / black `#0A0A0A`
- **Accent**: SNICKERS red `#C8102E` used sparingly on promo elements
- **Cards**: Gradient backgrounds per rarity (gold/purple/blue/gray)
- **Typography**: Barlow Condensed for display, Inter for body — sporty and readable

---
