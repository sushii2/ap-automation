# AP Automation

Accounts payable automation. Turborepo with Next.js 16, Cubby UI (shadcn registry, built on Base UI), and WorkOS auth (not wired up yet).

```
apps/web            Next.js app
packages/ui         Cubby UI components + theme (@workspace/ui)
packages/crypto     Field-level envelope encryption (@workspace/crypto)
```

## Setup

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
npm run keys:generate   # paste output into apps/web/.env.local
npm run dev
```

## Database

Neon Postgres with pgvector, through Drizzle. The schema is `apps/web/lib/db/schema.ts`; migrations live in `apps/web/drizzle`.

```bash
npm run db:generate -w web   # after editing the schema: write a migration
npm run db:migrate -w web    # apply pending migrations (uses DATABASE_URL_UNPOOLED)
```

The ingestion tasks write to the database, so the Trigger.dev project needs `DATABASE_URL`, `AI_GATEWAY_API_KEY` and the encryption variables too.

## Invoice chat

The dashboard chat runs on Claude Managed Agents: each chat is a session with its own sandbox, holding a snapshot of the organization's invoices and purchase orders, where the agent runs analysis and builds PDF or spreadsheet reports. The agent and its sandbox environment are defined in `apps/web/lib/chat/agent-config.ts`.

```bash
# with ANTHROPIC_API_KEY set in apps/web/.env.local
npm run chat:agent -w web   # creates the agent and environment, prints their IDs
```

Add the printed `CHAT_AGENT_ID` and `CHAT_ENVIRONMENT_ID` to `.env.local` (and to the deployment). Re-run the command after editing the agent config; it then updates them in place. Without these variables the chat is switched off.

## Adding Cubby UI components

```bash
cd packages/ui && npx shadcn@latest add @cubby-ui/<component>
```

Import with `@workspace/ui/components/ui/cubby-ui/<component>`. The shadcn MCP server is set up in `.mcp.json`.

## Security

See [SECURITY.md](./SECURITY.md) for encryption in transit/at rest and the compliance control mapping.
