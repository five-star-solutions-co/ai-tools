# Mastra Vector

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/mastra-vector` |
| **Kind** | **vendor** (`src/vendors/mastra-vector`) |
| **Module id** | `mastra-vector` |
| **Client** | `MastraVectorClient` |
| **Runtime** | **`node`** (Postgres via `@mastra/pg` PgVector) |

Wraps Mastra **`PgVector`**. Host owns the connection string, schema, and index lifecycle policy.

## Peer dependency

```bash
bun add @mastra/pg
```

Optional peer of `@5ss/ai-tools` (same idea as `@mastra/core` for the adapter).

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
  default_filter?: { organization_id: '…' }, // Mongo-style / flat equality via PgVector
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
  default_filter: { organization_id: 'org_42' },
})
```

## Filters

Query accepts optional tool `filter` (Mongo-style / flat equality). Host `default_filter` is always merged in (host keys win). Flat equality keys from `default_filter` are stamped onto upsert metadata.

## Not included

- `@mastra/memory` (working / observational memory) — host
- `@mastra/rag` `MDocument` / `createVectorQueryTool` — host product RAG (can use this store underneath)
- Org purpose / PHI classification — host
