# Deploy Prism to Netlify

## Goal
Self-host the existing Prism app on Netlify instead of Cloudflare Workers. No feature changes — only build/deploy retargeting. (MCP integration is paused per your choice.)

## Context (verified)
- Build is driven by `@lovable.dev/vite-tanstack-config`. It defaults Nitro to the `cloudflare-module` preset, but exposes a `nitro: { preset }` override that applies **outside the Lovable sandbox**. Inside the sandbox, `LOVABLE_NITRO_PRESET` pins Cloudflare and ignores the override — so the in-app preview/publish keeps targeting Cloudflare, untouched.
- `nitro` (3.0.260603-beta) is installed and ships a `netlify` preset. That preset outputs static assets to `dist/` and an SSR serverless function to `.netlify/functions-internal/server/`. Netlify auto-detects functions there; the generated function config (`path: "/*"`, `preferStatic: true`) routes non-static requests to SSR and serves prerendered assets directly.
- `src/server.ts` is already runtime-agnostic: a plain `{ fetch }` Nitro entry that wraps the TanStack Start server entry. No Cloudflare-specific APIs — works on Netlify Node functions.
- `LOVABLE_API_KEY` is read inside the cluster handler (`src/lib/cluster.functions.ts`), not at module scope. On Netlify Node functions, `process.env.LOVABLE_API_KEY` resolves from dashboard env vars. The AI SDK + global `fetch` are Node-compatible.

## Changes

### 1. `vite.config.ts`
Add `nitro: { preset: "netlify" }` to the existing `defineConfig(...)` options, above `tanstackStart`. This hard-pins Netlify for any build outside the sandbox (Netlify CI + local). The sandbox still forces Cloudflare, so Lovable preview/publish is unaffected.

```ts
export default defineConfig({
  nitro: { preset: "netlify" },
  tanstackStart: {
    server: { entry: "server" }, // keep the src/server.ts SSR error wrapper
  },
});
```

### 2. Create `netlify.toml`
Minimal, deterministic config. No `[functions]` override (Nitro's `.netlify/functions-internal/` is auto-detected). No secret values committed.

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
```

### 3. `LOVABLE_API_KEY` (manual, not in code)
Set `LOVABLE_API_KEY` in the Netlify dashboard under **Site settings → Environment variables**. It is the only secret required; without it, the "Run Demo" / upload analysis fails with `Missing LOVABLE_API_KEY`. Do **not** put it in a committed `.env`.

## What stays the same
- `src/server.ts`, `src/lib/*`, all product code — no edits.
- Lovable in-editor preview and Publish still deploy to Cloudflare (the override is sandbox-ignored).

## Verification after approval
- Run `npm run build` locally → confirm it emits `dist/` (assets) and `.netlify/functions-internal/server/` (function). (Cannot reproduce the Netlify preset inside the Lovable sandbox, which forces Cloudflare — this check runs in your local/Netlify CI.)
- Push to the connected GitHub repo; connect the repo to Netlify; set `LOVABLE_API_KEY`; deploy. Confirm the homepage renders (SSR) and "Run Demo" clustering returns results.
