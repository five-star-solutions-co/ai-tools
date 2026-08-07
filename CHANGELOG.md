# Changelog

All notable changes to `@5ss/ai-tools` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases are cut by [semantic-release](https://semantic-release.gitbook.io/) from [conventional commits](https://www.conventionalcommits.org/).

## [2.11.1](https://github.com/harryy2510/ai-tools/compare/v2.11.0...v2.11.1) (2026-08-07)

## [2.11.0](https://github.com/harryy2510/ai-tools/compare/v2.10.2...v2.11.0) (2026-08-07)

## [2.10.2](https://github.com/harryy2510/ai-tools/compare/v2.10.1...v2.10.2) (2026-08-07)

## [2.10.1](https://github.com/harryy2510/ai-tools/compare/v2.10.0...v2.10.1) (2026-08-05)

## [2.10.0](https://github.com/harryy2510/ai-tools/compare/v2.9.0...v2.10.0) (2026-08-03)

## [2.9.0](https://github.com/harryy2510/ai-tools/compare/v2.8.0...v2.9.0) (2026-08-02)

## [2.8.0](https://github.com/harryy2510/ai-tools/compare/v2.7.1...v2.8.0) (2026-07-29)

## [2.7.1](https://github.com/harryy2510/ai-tools/compare/v2.7.0...v2.7.1) (2026-07-29)

## [2.7.0](https://github.com/harryy2510/ai-tools/compare/v2.6.0...v2.7.0) (2026-07-29)

## [2.6.0](https://github.com/harryy2510/ai-tools/compare/v2.5.1...v2.6.0) (2026-07-29)

## [2.5.1](https://github.com/harryy2510/ai-tools/compare/v2.5.0...v2.5.1) (2026-07-28)

## [2.5.0](https://github.com/harryy2510/ai-tools/compare/v2.4.0...v2.5.0) (2026-07-28)

## [2.4.0](https://github.com/harryy2510/ai-tools/compare/v2.3.0...v2.4.0) (2026-07-28)

## [2.3.0](https://github.com/harryy2510/ai-tools/compare/v2.2.0...v2.3.0) (2026-07-28)

## [2.2.0](https://github.com/harryy2510/ai-tools/compare/v2.1.0...v2.2.0) (2026-07-28)

## [2.1.0](https://github.com/harryy2510/ai-tools/compare/v2.0.1...v2.1.0) (2026-07-28)

## [2.0.1](https://github.com/harryy2510/ai-tools/compare/v2.0.0...v2.0.1) (2026-07-27)

## [2.0.0](https://github.com/harryy2510/ai-tools/compare/v1.6.1...v2.0.0) (2026-07-27)

## [1.6.1](https://github.com/harryy2510/ai-tools/compare/v1.6.0...v1.6.1) (2026-07-24)

## [1.6.0](https://github.com/harryy2510/ai-tools/compare/v1.5.0...v1.6.0) (2026-07-24)

## [1.5.0](https://github.com/harryy2510/ai-tools/compare/v1.4.0...v1.5.0) (2026-07-24)

## [1.4.0](https://github.com/harryy2510/ai-tools/compare/v1.3.0...v1.4.0) (2026-07-23)

## [1.3.0](https://github.com/harryy2510/ai-tools/compare/v1.2.1...v1.3.0) (2026-07-23)

## [1.2.1](https://github.com/harryy2510/ai-tools/compare/v1.2.0...v1.2.1) (2026-07-23)

## [1.2.0](https://github.com/harryy2510/ai-tools/compare/v1.1.0...v1.2.0) (2026-07-23)

## [1.1.0](https://github.com/harryy2510/ai-tools/compare/v1.0.0...v1.1.0) (2026-07-21)

## 1.0.0 (2026-07-21)

# Changelog

All notable changes to `@5ss/ai-tools` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Releases are cut by semantic-release from conventional commits. See [docs/versioning.md](./docs/versioning.md).

## [Unreleased]

Notes for the next cut (hand-maintained until semantic-release rewrites on release). Empty `## [1.x.x]` sections above are produced by release automation.

### BREAKING CHANGE

Public surfaces removed or renamed since **v1.6.1** — next release **must** be a **major** (use `BREAKING CHANGE` footer / `type!:` on the release commit).

| Removed / changed | Migration |
| --- | --- |
| `@5ss/ai-tools/mime` | Use `@5ss/ai-tools/email-message` (parse/build) and/or `content-type` |
| `@5ss/ai-tools/storage` | Use `@5ss/ai-tools/s3` (or nested S3 auth on `files` / messaging media) |
| `@5ss/ai-tools/r2` | Use `s3` with R2 S3-compatible `endpoint` |
| `@5ss/ai-tools/supabase-storage` | Use S3-compatible storage or host Supabase client |
| `messaging-unsend` tool / seam `unsend` | Use `@5ss/ai-tools/imessage` `imessage-unsend` (or channel vendor) |
| email-message attachment `mimeType` | Renamed to **`mime_type`** |
| messaging media `source.store: 'host'` | Not accepted; use `store: 'object'` + nested `storage` auth |
| `messaging-download-file` output | When `destination_key` is set, response may include **`artifact`** and omit `body_base64` — handle both shapes |
| Messaging host client media | Prefer `MessagingClient.fromContext` / nested `storage` auth for ArtifactRef media; resolve storage before send |
| Invalid base64 on media/bodies | Always `ToolError` code **`bad_input`** (never raw `DOMException`) |
| Hooks + output validation | `runTool` owns bind → hooks → execute → output validation; output schema is parsed **once** |
| `mergeToolContext` / adapter `createContext` | Explicit `undefined` fields **do not** erase base `signal` / `fetch` / `auth` / `now` |
| MCP `context` | Still accepts static `ToolContext` **or** factory `() => ToolContext \| Promise<…>` (and deprecated `contextFactory`) |

### Notes (compat preserved)

- Adapter `createContext` callbacks use the installed framework execution-context types.
- S3 `get` / `getBytes({ maxBytes })` use HEAD + conditional Range GET (`If-Match` when etag is known) plus bounded response streaming.

### Historical note

Early public notes under **0.0.1** below are archival. MIME parse/build is **`email-message`** (not a `mime` pack). Object store is **`s3`** (+ nested S3 on `files` / artifact media); there is no multi-provider `storage` seam or published `r2` / `supabase-storage` packs.

## [0.0.1] - 2026-07-21

Initial public package surface (archival).

### Added

- **Kernel (`@5ss/ai-tools/core`)** — `defineTool`, `defineModule`, `withAuth`, `runTool`, contracts, catalog, JSON Schema projection, stable `ToolError` codes.
- **HTTP** surface and framework adapters (Mastra, AI SDK, TanStack, Cloudflare, MCP).
- Early product modules and tooling (see git history for full evolution).

[Unreleased]: https://github.com/harryy2510/ai-tools/compare/v1.6.1...HEAD
[0.0.1]: https://github.com/harryy2510/ai-tools/releases/tag/v0.0.1
