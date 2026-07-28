# Pinecone

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/pinecone` |
| **Kind** | **vendor** (`src/vendors/pinecone`) |
| **Module id** | `pinecone` |
| **Client** | `PineconeClient` |
| **Runtime** | `both` |

Pinecone data-plane REST: upsert / query / delete.

## Auth

```ts
{
  api_key: string,
  base_url: 'https://xxxx.svc.….pinecone.io', // full origin URL
  default_namespace?: string,  // locked for all calls when set
  default_filter?: Record<string, unknown>, // always on query; flat keys stamped on upsert
}
```

## Tools

| id | Method |
| --- | --- |
| `pinecone-upsert` | `upsert` |
| `pinecone-query` | `query` |
| `pinecone-delete` | `delete` |

Seam: [vector-store](../modules/vector-store.md) with `provider: 'pinecone'`.
