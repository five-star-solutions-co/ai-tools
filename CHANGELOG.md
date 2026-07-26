# Changelog

All notable changes to `@harryy/ai-tools` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases are cut by [semantic-release](https://semantic-release.gitbook.io/) from [conventional commits](https://www.conventionalcommits.org/).

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

All notable changes to `@harryy/ai-tools` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Releases are cut by semantic-release from conventional commits. See [docs/versioning.md](./docs/versioning.md).

## [Unreleased]

Notes for the next cut (hand-maintained until semantic-release rewrites on release). Empty `## [1.x.x]` sections above are produced by release automation.

### BREAKING CHANGE

Public surfaces removed or renamed since **v1.6.1** — next release **must** be a **major** (use `BREAKING CHANGE` footer / `type!:` on the release commit).

| Removed / changed | Migration |
| --- | --- |
| `@harryy/ai-tools/mime` | Use `@harryy/ai-tools/email-message` (parse/build) and/or `content-type` |
| `@harryy/ai-tools/storage` | Use `@harryy/ai-tools/s3` (or nested S3 auth on `files` / messaging media) |
| `@harryy/ai-tools/r2` | Use `s3` with R2 S3-compatible `endpoint` |
| `@harryy/ai-tools/supabase-storage` | Use S3-compatible storage or host Supabase client |
| `messaging-unsend` tool / seam `unsend` | Use `@harryy/ai-tools/imessage` `imessage-unsend` (or channel vendor) |
| email-message attachment `mimeType` | Renamed to **`mime_type`** |
| messaging media `source.store: 'host'` | Not accepted; use `store: 'object'` + nested `storage` auth |

### Historical note

Early public notes under **0.0.1** below are archival. MIME parse/build is **`email-message`** (not a `mime` pack). Object store is **`s3`** (+ nested S3 on `files` / artifact media); there is no multi-provider `storage` seam or published `r2` / `supabase-storage` packs.

## [0.0.1] - 2026-07-21

Initial public package surface (archival).

### Added

- **Kernel (`@harryy/ai-tools/core`)** — `defineTool`, `defineModule`, `withAuth`, `runTool`, contracts, catalog, JSON Schema projection, stable `ToolError` codes.
- **HTTP** surface and framework adapters (Mastra, AI SDK, TanStack, Cloudflare, MCP).
- Early product modules and tooling (see git history for full evolution).

[Unreleased]: https://github.com/harryy2510/ai-tools/compare/v1.6.1...HEAD
[0.0.1]: https://github.com/harryy2510/ai-tools/releases/tag/v0.0.1
