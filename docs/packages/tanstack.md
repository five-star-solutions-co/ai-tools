# `@5ss/ai-tools/tanstack`

Project kernel tools to [TanStack AI](https://tanstack.com/ai).

## Peer

```bash
bun add @tanstack/ai   # >= 0.40
```

## API

```ts
import {
  createTanStackTool,
  createTanStackTools,
  createTanStackToolRecord,
} from '@5ss/ai-tools/tanstack'
```

| Helper | Use |
| --- | --- |
| `createTanStackTool` | Single tool |
| `createTanStackTools` | From module or list |
| `createTanStackToolRecord` | Named record keyed for TanStack registration |

Bind auth before projecting credentialed modules.

## Related

- [Adapters guide](../guides/adapters.md)
