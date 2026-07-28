# Vector Store

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/vector-store` |
| **Kind** | multi-provider **seam** (`src/modules/vector-store`) |
| **Module id** | `vector-store` |
| **Providers** | `qdrant`, `pinecone`, `supabase`, `mastra` |
| **Client** | `VectorStoreClient` |
| **Runtime** | `both` |

Capability seam: upsert / query / delete vectors. HTTP lives in **vendor packs**; providers here only wrap them (same pattern as [email](./email.md)).

| Seam provider | Vendor pack |
| --- | --- |
| `qdrant` | [@harryy/ai-tools/qdrant](../vendors/qdrant.md) |
| `pinecone` | [@harryy/ai-tools/pinecone](../vendors/pinecone.md) |
| `supabase` | [@harryy/ai-tools/supabase-vector](../vendors/supabase-vector.md) |
| `mastra` | [@harryy/ai-tools/mastra-vector](../vendors/mastra-vector.md) (`@mastra/pg` PgVector, **node**) |

Shared I/O shapes: `vendors/_vector/` (codegen-skipped kit).

## Auth

```ts
{ provider: 'qdrant', base_url: '…', api_key?: '…', default_collection?: '…', default_filter?: { … } }
{ provider: 'pinecone', api_key: '…', base_url: 'https://…', default_namespace?: '…', default_filter?: { … } }
{ provider: 'supabase', url: '…', api_key: '…', default_collection?: '…', match_rpc?: '…', default_filter?: { … } }
{ provider: 'mastra', connection_string: '…', id: '…', schema_name?: 'agent', default_index?: '…', default_filter?: { … } }
```

### Tenant isolation (native store features)

| Auth field | Behavior |
| --- | --- |
| `default_filter` | Always applied on **query**. Tool `filter` is merged with **host keys winning**. Flat equality keys are **stamped onto upsert metadata** so points match the filter. |
| `default_namespace` (Pinecone) | **Locked** when set — all upsert/query/delete use it; tool cannot switch namespace. |

Providers execute their native filter/namespace APIs. This package only enforces host-bound defaults so the model cannot omit tenant isolation.

Example:

```ts
withAuth(vectorStoreModule, {
  provider: 'pinecone',
  api_key: '…',
  base_url: 'https://…',
  default_namespace: 'org_42',
  default_filter: { organization_id: 'org_42' },
})
```

## Tools

| id | Method |
| --- | --- |
| `vector-store-upsert` | `upsert` |
| `vector-store-query` | `query` |
| `vector-store-delete` | `delete` |

## Bind

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { VectorStoreClient, vectorStoreModule } from '@harryy/ai-tools/vector-store'

VectorStoreClient.fromAuth({
  provider: 'supabase',
  url: process.env.SUPABASE_URL!,
  api_key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  default_collection: 'org_memory',
  default_filter: { organization_id: 'org_42' },
})

withAuth(vectorStoreModule, { /* same */ })
```

## Related

- [rag](./rag.md) — chunk + host embed + nested vector-store
- Mastra Memory / working conversation memory — **host** (`@mastra/memory`)
