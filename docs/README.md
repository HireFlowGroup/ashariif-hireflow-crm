# HireFlow AI

Production-oriented recruitment CRM built with Next.js 15, Supabase, and shadcn/ui.

## Architecture

```
src/
  app/
    (auth)/              Public authentication routes
    (dashboard)/         Protected SaaS workspace routes
    api/                 Route handlers (auth callback, AI chat)
  components/
    auth/                Authentication UI
    ai/                  AI assistant UI
    layout/              Dashboard shell (sidebar, header)
    providers/           Theme, React Query, tooltips
    shared/              Reusable presentation components
    ui/                  shadcn/ui primitives
  config/                Site and navigation configuration
  hooks/                 Client hooks (auth session via React Query)
  lib/
    env.ts               Environment validation
    openai/              Server-side OpenAI client factory
    supabase/            Browser/server/middleware Supabase clients
    validations/         Zod schemas
  types/                 CRM domain and Supabase database types
supabase/migrations/     SQL schema + RLS policies
```

## Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (optional)

Configure Supabase Auth redirect URL:

- `http://localhost:3000/api/auth/callback`

## Supabase

Apply migrations from `supabase/migrations` using the Supabase CLI or SQL editor.
The schema includes multi-tenant organization scoping and row level security policies.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run start` — run production server
- `npm run lint` — ESLint
- `npm run format` — Prettier write
- `npm run format:check` — Prettier check
