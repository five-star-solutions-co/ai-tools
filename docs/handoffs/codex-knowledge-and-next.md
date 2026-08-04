# Codex handout — knowledge slice + how not to fuck up

**Repo:** `/Users/harryy/Desktop/hariom/ai-tools` (`@harryy/ai-tools`)  
**Status:** knowledge/memory work is **uncommitted** (user reviews → then commit on request).  
**Do not commit** unless the user explicitly says `commit`.

Read first, in order:

1. `AGENTS.md` (hard rules)
2. `docs/specs/package-surface-architecture.md`
3. `docs/specs/provider-seam.md`
4. Gold files below — **clone them**, do not invent layout

---

## 1. Architecture locks (non-negotiable)

### Two roots

| Root | What goes here | Public import |
| --- | --- | --- |
| `src/modules/<key>/` | **Seams we own** (capability contract, multi-provider) | `@harryy/ai-tools/<key>` |
| `src/vendors/<key>/` | **3rd-party product** full pack (HTTP + tools) | `@harryy/ai-tools/<key>` |

### Vertical kits (underscore = not a pack)

| Kit | Pattern |
| --- | --- |
| `vendors/_storage/` | **Schemas + types only** on barrel (`index.ts`). No helper dump. |
| `vendors/_email/` | Shared email schemas |
| `vendors/_messaging/` | Live message helpers |
| `vendors/_vector/` | **Same as `_storage`:** schemas on barrel; parse helpers only in `domain.ts` (import `../_vector/domain`, **not** from kit barrel) |

Codegen **skips** `_foo`. Never hand-edit `package.json` exports / `tsdown.config.ts` / `generated/*` — run `bun run codegen`.

### Gold files (copy these)

| Kind | Path |
| --- | --- |
| Vendor pack | `src/vendors/resend/` (`client.ts`, `contracts.ts`, `module.ts`, `index.ts`) |
| Vendor domain parse | `src/vendors/s3/domain.ts` + client uses es-toolkit |
| Multi-provider seam | `src/modules/email/` |
| Thin seam provider | `src/modules/email/providers/resend.ts` — **only** strips `provider`, wraps vendor client |
| Kit barrel | `src/vendors/_storage/index.ts` — **schemas only** |

### Seam provider rule

```text
modules/<seam>/providers/foo.ts   →  thin wrap of vendors/foo Client
vendors/foo/client.ts             →  owns HttpService + vendor API
```

**Forbidden:** fat HTTP / ofetch / REST mapping living only under `modules/*/providers/*.ts`.

### Helpers rule

- Prefer **es-toolkit** (`isPlainObject`, `isString`, `isNumber`, `isBoolean`, `isNil`, `mapValues`, `trim`, `pick`, …).
- Do **not** invent a public kit export soup (`asMetadata`, `asNumberArray`, … on `_vector/index.ts`).
- Kit barrel = schemas/types. Domain parse = `domain.ts` (per vendor or shared kit domain, private import).

### Transport

- All app HTTP: `HttpService` / `AwsService` (`src/transport/`).
- `HttpService` already does `trimEnd(baseURL, '/')` — **do not** re-strip trailing slashes on every client.
- Strip/join only when **string-concatenating** paths yourself (e.g. `` `${origin}/rest/v1` ``).

### Optional spreads (AGENTS R-optional-spread)

```ts
// Preferred
...(ctx.fetch && { fetch: ctx.fetch }),
...(limit !== undefined && { limit }), // when 0 is valid

// BANNED ternary empty-object soup
...(x === undefined ? {} : { key: x })

// Also OK
const o: Options = { baseURL, headers, label }
if (options.fetch) o.fetch = options.fetch
```

### Auth / tools

- Auth snake_case; host binds via `withAuth`; **never** secrets on tool inputs.
- Tool ids kebab-case; vendor-prefixed (`qdrant-upsert`) or capability-prefixed (`vector-store-upsert`).
- Model-facing descriptions: no “credentials”, “env”, “host binds”, vault language (`forbidden_model_copy`).

### Verify

```bash
bun run codegen          # after new pack index.ts
bun run typecheck
bun test test/modules/<…>.test.ts test/vendors/<…>.test.ts
oxfmt --write <session paths only>
```

No `bun run format` repo-wide. No commit unless asked.

---

## 2. What this session delivered (knowledge / memory)

### Product intent (roadmap slice 7)

| Piece | Package | Host |
| --- | --- | --- |
| `vector-store` | upsert / query / delete | DB URL, keys, collection names |
| `rag` | chunk + embed + store + retrieve | OpenAI-compatible embed route + nested vector auth |
| Mastra Memory | **not packaged** | host `@mastra/memory` / PG only |

### Correct final layout

```text
src/vendors/_vector/
  schemas.ts          # shared I/O Zod
  domain.ts           # private parse helpers (es-toolkit); NOT on barrel
  index.ts            # schemas + types only

src/vendors/qdrant/           # QdrantClient + qdrant-* tools
src/vendors/pinecone/         # PineconeClient + pinecone-* tools
src/vendors/supabase-vector/  # SupabaseVectorClient + supabase-vector-* tools (pgvector/PostgREST)

src/modules/vector-store/
  contracts.ts        # auth union = vendorAuth.extend({ provider })
  client.ts           # switch provider → thin provider
  module.ts           # vector-store-* tools
  providers/*.ts      # wrap vendor clients only

src/modules/rag/
  contracts.ts        # nested vector_store auth + embed auth
  domain.ts           # chunkText (pure)
  client.ts           # embed HTTP + VectorStoreClient
  module.ts           # rag-ingest / rag-retrieve / rag-delete
```

### Imports

```ts
@harryy/ai-tools/vector-store
@harryy/ai-tools/rag
@harryy/ai-tools/qdrant
@harryy/ai-tools/pinecone
@harryy/ai-tools/supabase-vector
```

### Auth shapes (summary)

**Seam vector-store**

```ts
{ provider: 'qdrant', base_url, api_key?, default_collection? }
{ provider: 'pinecone', api_key, base_url, default_namespace? }
{ provider: 'supabase', url, api_key, default_collection?, schema?, id_column?, embedding_column?, metadata_column?, match_rpc? }
```

**RAG**

```ts
{
  vector_store: /* same seam union */,
  embed: { base_url, api_key?, model, path?, dimensions? },  // OpenAI-compatible POST …/embeddings
  default_collection?,
  chunk?: { max_chars?, overlap? },
}
```

**Supabase host contract:** table + RPC `match_vectors` (name configurable). See `docs/vendors/supabase-vector.md`.

### Docs already touched

- `docs/modules/vector-store.md`, `docs/modules/rag.md`
- `docs/vendors/qdrant.md`, `pinecone.md`, `supabase-vector.md`
- `docs/README.md`, root `README.md`, `CHANGELOG.md` Unreleased
- `docs/roadmap/package-surface-working.md` (slice 7 Done)
- `docs/specs/provider-seam.md`, `package-surface-architecture.md`

### Tests

- `test/modules/vector-store.test.ts`
- `test/modules/rag.test.ts`
- `test/vendors/qdrant.test.ts` (only one vendor test — fine to extend pinecone/supabase-vector)

---

## 3. Mistakes already made this session (do not repeat)

1. **Fat HTTP under `modules/vector-store/providers/*`**  
   Wrong. Must be vendor packs + thin wraps. Fixed once; keep it fixed.

2. **`_vector/index.ts` exporting helper soup** (`asMetadata`, `asNumberArray`, …)  
   Wrong. Barrel = schemas only like `_storage`. Helpers → `_vector/domain.ts` + es-toolkit.

3. **Redundant `base_url.replace(/\/+$/, '')` on every HttpService**  
   Useless; HttpService trims. Only normalize when building string URLs.

4. **Module descriptions mentioning credentials / host binding**  
   Fails `validateModule` (`forbidden_model_copy`).

5. **Inventing structure instead of cloning storage/resend**  
   Always open gold first.

---

## 4. User’s delivery cadence (binding)

User order of product slices:

1. **Knowledge / memory** ← current uncommitted work (`vector-store` + `rag` + vendors). Review → commit when asked.
2. **calendar** — ICS build / thin CalDAV  
3. **crypto** — HMAC / JWT verify pure helpers  
4. **image** — resize/thumb (imgproxy / sharp)  
5. Later talk: **pdf** (merge/split/page), **browser** (scrape / browserless)

**One slice → user reviews → user says commit → next.** Do not stack unreviewed slices.

Planned architecture rows (from `package-surface-architecture.md`):

| Module | Job | Notes |
| --- | --- | --- |
| `calendar` | ICS build / thin CalDAV | ical pure; CalDAV ofetch |
| `crypto` | HMAC, JWT verify | pure / `auth: none` or host secrets |
| `image` | resize, thumb | imgproxy, sharp (node), … |
| `pdf` | merge, split, page ops | not document-render |
| `browser` | scrape / structured page | browserless; overlap with document-render exists |

---

## 5. If you continue knowledge slice

Before anything else:

```bash
cd /Users/harryy/Desktop/hariom/ai-tools
bun run typecheck
bun test test/modules/vector-store.test.ts test/modules/rag.test.ts test/vendors/qdrant.test.ts
```

Git is dirty with the knowledge work — **do not** mix calendar/crypto into the same uncommitted tree without user OK.

Possible follow-ups (only if user asks):

- Vendor tests for pinecone + supabase-vector  
- More pgvector RPC flexibility  
- Commit when user says commit  

---

## 6. Minimal “clone storage” checklist for a new multi-provider seam

1. Vendor pack per backend under `src/vendors/<name>/` (full client + tools).  
2. Optional kit `src/vendors/_<vertical>/` with **schemas only** on `index.ts`.  
3. Seam `src/modules/<capability>/`:
   - `contracts.ts`: I/O from kit + `vendorAuth.extend({ provider: z.literal(...) })` union  
   - `providers/*.ts`: strip `provider`, `new VendorClient(vendorAuth, options)`  
   - `client.ts` / `module.ts` / `index.ts`  
4. Docs: `docs/modules/<capability>.md` + `docs/vendors/<name>.md` + README tables.  
5. `bun run codegen` + tests + typecheck.  
6. Leave uncommitted until user says commit.

---

## 7. Adjacent work already on main (context only)

- Messaging vendors: telegram, slack, teams, imessage  
- imessage via **@photon-ai/advanced-imessage** HTTP (`createHttpClient`); inbound webhooks stay host  
- Do not mix proxy work into this knowledge commit unless asked  

---

**End handout.** Follow gold. Prefer es-toolkit. Vendors own HTTP. Kits own schemas. Seams only wire.
