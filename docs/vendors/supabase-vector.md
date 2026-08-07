# Supabase Vector

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/supabase-vector` |
| **Kind** | **vendor** (`src/vendors/supabase-vector`) |
| **Module id** | `supabase-vector` |
| **Client** | `SupabaseVectorClient` |
| **Runtime** | `both` |

Supabase Postgres + **pgvector** via PostgREST.

## Auth

```ts
{
  url: 'https://xxxx.supabase.co',
  api_key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  default_collection?: 'documents', // table name
  schema?: 'public',
  id_column?: 'id',
  embedding_column?: 'embedding',
  metadata_column?: 'metadata',
  match_rpc?: 'match_vectors',
  default_filter?: { organization_id: '…' }, // always passed to match RPC; flat keys stamped on upsert
}
```

## Host schema

Package assumes a table + match RPC. Example:

```sql
create table documents (
  id text primary key,
  embedding vector(1536),
  metadata jsonb
);

create or replace function match_vectors(
  query_embedding vector,
  match_count int,
  filter jsonb default null,
  collection text default null
)
returns table (id text, score float, metadata jsonb, embedding vector)
language sql stable as $$
  select d.id,
         1 - (d.embedding <=> query_embedding) as score,
         d.metadata,
         d.embedding
  from documents d
  order by d.embedding <=> query_embedding
  limit match_count;
$$;
```

## Tools

| id | Method |
| --- | --- |
| `supabase-vector-upsert` | `upsert` |
| `supabase-vector-query` | `query` |
| `supabase-vector-delete` | `delete` |

Seam: [vector-store](../modules/vector-store.md) with `provider: 'supabase'`.
