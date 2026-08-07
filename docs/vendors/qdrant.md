# Qdrant

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/qdrant` |
| **Kind** | **vendor** (`src/vendors/qdrant`) |
| **Module id** | `qdrant` |
| **Client** | `QdrantClient` |
| **Runtime** | `both` |

Qdrant REST: upsert / search / delete points.

## Auth

```ts
{
  base_url: 'https://xxx.cloud.qdrant.io', // or http://127.0.0.1:6333
  api_key?: string,
  default_collection?: string,
  default_filter?: { organization_id: '…' }, // flat equality → must; or native must/should
}
```

## Tools

| id | Method |
| --- | --- |
| `qdrant-upsert` | `upsert` |
| `qdrant-query` | `query` |
| `qdrant-delete` | `delete` |

Seam: [vector-store](../modules/vector-store.md) with `provider: 'qdrant'`.
