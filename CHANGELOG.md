# Changelog

All notable changes to `@harryy/ai-tools` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases are cut by [semantic-release](https://semantic-release.gitbook.io/) from [conventional commits](https://www.conventionalcommits.org/).

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

### Added

- **`vector-store` module** — seam over vendor packs; providers `qdrant`, `pinecone`, `supabase`, `mastra`.
- **`vendors/qdrant`**, **`vendors/pinecone`**, **`vendors/supabase-vector`**, **`vendors/mastra-vector`** — vector backends (shared I/O in `vendors/_vector`; mastra = `@mastra/pg` PgVector, optional peer).
- **`rag` module** — chunk + OpenAI-compatible embed route + nested vector-store (ingest / retrieve / delete).
- Docs wiki under `docs/` (guides, brain packages, product modules).
- Module scaffold writes `docs/modules/<key>.md` stub.
- **semantic-release** on `main` (conventional commits → version, changelog, tag, npm OIDC).
- **`web-fetch` module** — allowlisted HTTP client on **ofetch** (`web-fetch-get` / `web-fetch-request`).
- **`document-extract`** — Textract text extract from S3 `ArtifactRef` with internal poll; `document-extract-status` for `job_id`.
- **`file-convert`** — Transmute-backed convert for S3 artifacts.
- Spec: `docs/specs/artifacts-extract-convert.md`.

### Changed

- CI check workflow polish; repository URL `harryy2510/ai-tools`.
- Replaced hand-rolled / token publish paths with `release.yml` + Trusted Publisher (`release.yml`).

## [0.0.1] - 2026-07-21

Initial public package surface.

### Added

- **Kernel (`@harryy/ai-tools/core`)** — `defineTool`, `defineModule`, `withAuth`, `runTool`, contracts, catalog, JSON Schema projection, stable `ToolError` codes.
- **HTTP factory (`@harryy/ai-tools/http`)** — fixed-origin `defineHttpApi` / `httpRequest` helpers.
- **Adapters** — Mastra, Vercel AI SDK, TanStack AI, Cloudflare Workers AI tool defs, MCP list/call + register.
- **Module codegen** — oxc-parser discovery of `src/modules/*` → `package.json` exports, tsdown entries, manifest, module keys.
- **Product modules**
  - `cloudflare-email` — transactional send via Cloudflare Email Service REST API.
  - `s3-storage` — list/get/put/delete/head/copy + presigned URLs (S3-compatible including R2/MinIO).
  - `mime` — parse/build RFC 822 MIME messages (attachments, headers).
- **Scaffold** — `bun run new-module <kebab-key>`.
- **Tooling** — Bun, oxfmt, type-aware oxlint, lefthook, tsdown, `bun run check` gate.
- **CI** — GitHub Actions check + build + pack dry-run on push/PR.

### Hardening (modules)

- Email: 5 MiB preflight, richer upstream error mapping.
- S3: object metadata on list, put size limit, copy, signed URLs, optional session token.
- MIME: richer parse fields; build-time attachments and custom headers.

[Unreleased]: https://github.com/harryy2510/ai-tools/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/harryy2510/ai-tools/releases/tag/v0.0.1
