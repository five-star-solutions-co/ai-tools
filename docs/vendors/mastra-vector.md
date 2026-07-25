# Mastra Vector

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/mastra-vector` |
| **Kind** | **vendor** (`src/vendors/mastra-vector`) |
| **Module id** | `mastra-vector` |
| **Client** | `MastraVectorClient` |
| **Runtime** | **`node`** (Postgres via `@mastra/pg` PgVector) |

Wraps Mastra **`PgVector`**. Host owns the connection string, schema, and index lifecycle policy.

## Peer dependency

```bash
bun add @mastra/pg
```

Optional peer of `@harryy/ai-tools` (same idea as `@mastra/core` for the adapter).

## Auth

```ts
{
  connection_string: process.env.SUPABASE_DB_URL!,
  id: 'org-knowledge-vectors',       // Mastra store id
  schema_name?: 'agent',
  default_index?: 'organization_knowledge',
  dimension?: 1024,                  // needed if auto_create_index
  auto_create_index?: false,
  disable_init?: true,               // host manages store init when true
}
```

`collection` on tools maps to Mastra **`indexName`**.

## Tools

| id | Method |
| --- | --- |
| `mastra-vector-upsert` | `upsert` |
| `mastra-vector-query` | `query` |
| `mastra-vector-delete` | `delete` |

## Seam

[vector-store](../modules/vector-store.md) with `provider: 'mastra'`.

```ts
withAuth(vectorStoreModule, {
  provider: 'mastra',
  connection_string: process.env.SUPABASE_DB_URL!,
  id: 'org-knowledge-vectors',
  schema_name: 'agent',
  default_index: 'organization_knowledge',
  disable_init: true,
})
```

## Filter note

Shared seam `filter` is an opaque `Record`. Mastra’s `PGVectorFilter` is typed more tightly, so **query `filter` is rejected** on this pack for now (`unsupported`). Hosts that need Mastra filters should call `PgVector` directly or extend the pack.

## Not included

- `@mastra/memory` (working / observational memory) — host
- `@mastra/rag` `MDocument` / `createVectorQueryTool` — host product RAG (can use this store underneath)
- Org purpose / PHI classification — host
