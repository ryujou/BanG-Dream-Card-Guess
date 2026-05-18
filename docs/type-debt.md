# Type Debt Baseline

This document records the local TypeScript debt baseline for the `refactor/vue3-ts` branch.

## Current Baseline

Command:

```sh
npm run check:any
```

Current result after phase 13:

```text
TOTAL  0
```

Phase 13 started from `TOTAL 55` in the full `src + scripts + tests` scan. The remaining explicit `any` count is now zero in scanned TypeScript, Vue, and script sources.

## Cleaned Areas

- `scripts/cache-cards.ts` was rewritten as UTF-8 TypeScript and now uses explicit `CacheCard` and `CacheJob` types.
- Frontend runtime data in QR, diagnostics, scores, settings, game stage, reveal stage, topbar, home, and host views now uses local or shared types.
- Test helpers now avoid explicit `any`.
- CSS and dynamic browser module imports no longer require `@ts-ignore`.
- Stale source-health references to old server coverage and old frontend entry exclusions were removed from active config/scripts.

## Remaining Boundaries

The codebase still uses `unknown` at external input boundaries by design:

- HTTP request body parsing.
- WebSocket message payloads.
- diagnostics and health snapshots.
- imported settings JSON.
- score files.
- Bestdori/card/cache data.

These values should be narrowed through guards, normalizers, or local boundary types before business logic consumes them.

## Rules Going Forward

- Do not add new explicit `any` without a short local comment explaining why no narrower type is practical.
- Prefer `unknown` plus a guard for external data.
- Prefer shared protocol types for WebSocket, health, diagnostics, and scores.
- Keep compatibility bridge casts close to the boundary that needs them.
- Next target: keep `npm run check:any` at `TOTAL 0` while tightening remaining broad `Record<string, unknown>` shapes.
