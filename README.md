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

## Adding Cubby UI components

```bash
cd packages/ui && npx shadcn@latest add @cubby-ui/<component>
```

Import with `@workspace/ui/components/ui/cubby-ui/<component>`. The shadcn MCP server is set up in `.mcp.json`.

## Security

See [SECURITY.md](./SECURITY.md) for encryption in transit/at rest and the compliance control mapping.
