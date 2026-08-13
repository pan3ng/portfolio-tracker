# Portfolio Tracker

Status: **Phase 1 — Repo Init** (per `Stack_Playbook` §3). Boilerplate only, no feature
code yet. This satisfies the Phase 1 gate checklist from the playbook:

- [x] Turborepo monorepo scaffolded (`apps/*`, `packages/*`)
- [x] `apps/web` — Next.js (App Router) stub
- [x] `apps/mobile` — Expo (TS template) stub
- [x] `packages/schemas` — Zod schemas: `Transaction`, `Target`, `Holding`, `Quote`
      (single source of truth, mirrors `portfolio-tracker-architecture.md` §4)
- [x] `packages/api-client` — single Supabase client factory + `fetchQuote()` wrapper
- [x] `supabase/migrations/0001_init.sql` — `transactions` + `targets` tables, RLS
      enabled from migration #1
- [x] `supabase/functions/get-quote` — isolated Yahoo Finance price-fetch module
      (ZAc → ZAR conversion happens exactly once, here — see architecture doc §3)

## Not done yet (still Phase 1 gate items)

- [ ] `npm install` at root to link workspaces + resolve deps
- [ ] Supabase project created (dev env) and linked (`supabase link`)
- [ ] Apply `0001_init.sql` to that project, run `supabase gen types typescript`
- [ ] Vercel project linked to `apps/web`
- [ ] EAS project configured (`eas.json`) for `apps/mobile`
- [ ] Confirm gate: `apps/web` deploys an empty page to Vercel, `apps/mobile` runs in
      Expo Go, both read from the same Supabase project

## Next per the Execution Roadmap

Once the Phase 1 gate above is green, move to **Phase 2 — Web MVP**:
Auth (pick magic link or OAuth, not both), migrate the core data model with RLS
policies alongside the tables (already done in `0001_init.sql`), then build the
core transaction-entry + allocation-view flow from the sequence diagram in
`portfolio-tracker-architecture.md` §4.

## Env vars needed

`apps/web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```
