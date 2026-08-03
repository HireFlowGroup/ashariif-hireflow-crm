# HireFlow Enterprise Architecture

## Principles

| Principle | Implementation |
|-----------|----------------|
| **Clean Architecture** | Features = domain → application → infrastructure. UI/API are adapters. |
| **DDD** | Bounded contexts per feature module (`companies`, `hiring-intelligence`, `outreach-intelligence`). |
| **CQRS** | Write models in Postgres; read models via views (`companies_intelligence`) + `platform_events` projections. |
| **DI** | `src/platform/di/` — request-scoped composition root, injectable Supabase client. |
| **SOLID** | Repository interfaces, single-responsibility services, feature factories. |

## Platform Layer (`src/platform/`)

```
platform/
  config/       env validation (Zod), feature flags
  di/           Container, composition root, tokens
  observability/ structured JSON logging, metrics, OTel-compatible tracing
  http/         API handler wrapper, rate limiting, API versioning (v1)
  resilience/   Retry with exponential backoff
  cache/        Memory cache (Redis adapter ready)
  events/       In-process event bus + platform_events persistence
  audit/        AI tool execution audit trail
  errors/       DomainError + HTTP envelope mapping
```

## Security

- **Supabase RLS** on all tenant tables via `current_organization_id()`
- **Rate limiting** per org/user
- **Audit logging** for AI tool executions (`ai_tool_logs`)
- **Cron routes** protected by `CRON_SECRET` / `WORKER_SECRET`

## Observability

- Structured JSON logs with `requestId`
- Metrics at `/api/platform/metrics`
- OpenTelemetry-compatible tracing (`OTEL_ENABLED=true`)

## Migrations

```bash
npx supabase db push
```

Platform migration: `20250803280000_platform_enterprise.sql`
