# RAG

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/rag` |
| **Kind** | **seam** (`src/modules/rag`) |
| **Module id** | `rag` |
| **Client** | `RagClient` |
| **Runtime** | `both` |

Ingest + retrieve: **chunk → embed → vector upsert** and **embed query → nearest chunks**.

Host owns:

- OpenAI-compatible **embed** route (model + URL + key)
- Nested **vector-store** credentials (qdrant / pinecone)
- Collection names and org / PHI classification policy

## Auth

```ts
{
  vector_store: {
    provider: 'qdrant', // or 'pinecone' | 'supabase' | 'mastra'
    base_url: '…',
    api_key?: '…',
    default_collection?: '…',
  },
  // mastra: { provider: 'mastra', connection_string, id, schema_name?, default_index? }
  // supabase: { provider: 'supabase', url, api_key, default_collection?, match_rpc? }
  // pinecone: { provider: 'pinecone', api_key, base_url, … }
  embed: {
    base_url: 'https://openrouter.ai/api/v1', // OpenAI-compatible /embeddings
    api_key?: string,
    model: 'text-embedding-3-small',
    path?: '/embeddings',
    dimensions?: number,
  },
  default_collection?: string,
  chunk?: { max_chars?: number, overlap?: number },
}
```

## Tools

| id | Method |
| --- | --- |
| `rag-ingest` | `ingest` — chunk, embed, upsert; returns `chunk_ids` |
| `rag-retrieve` | `retrieve` — embed query, nearest neighbors |
| `rag-delete` | `delete` — delete by `chunk_ids` from a prior ingest |

Chunk ids are `{document_id}#{index}`. Ingest stores `text`, `document_id`, and `chunk_index` in vector metadata so retrieve can return text.

## Pure helpers

```ts
import { chunkText, chunkId } from '@5ss/ai-tools/rag'

chunkText(longText, { max_chars: 1200, overlap: 200 })
```

## Bind

```ts
import { withAuth } from '@5ss/ai-tools/core'
import { RagClient, ragModule } from '@5ss/ai-tools/rag'

const rag = RagClient.fromAuth({
  vector_store: {
    provider: 'qdrant',
    base_url: process.env.QDRANT_URL!,
    default_collection: 'knowledge',
  },
  embed: {
    base_url: 'https://openrouter.ai/api/v1',
    api_key: process.env.OPENROUTER_API_KEY!,
    model: 'openai/text-embedding-3-small',
  },
})

await rag.ingest({ document_id: 'policy-1', text: '…' })
const hits = await rag.retrieve({ query: 'refund window', top_k: 5 })

withAuth(ragModule, { /* same auth */ })
```

## Out of scope

- **Mastra Memory** / working conversation memory — host (`@mastra/memory`, PG)
- Product org-RAG purpose / PHI routing — host policy, not this package
