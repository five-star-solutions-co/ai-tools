# Queue

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/queue` |
| **Kind** | capability seam |
| **Provider** | `sqs` |

| Tool | Purpose |
| --- | --- |
| `queue-enqueue` | Add one message |
| `queue-receive` | Receive a bounded batch with optional long polling |
| `queue-acknowledge` | Remove a successfully processed delivery |
| `queue-extend-visibility` | Extend the processing window |

Receipt handles are opaque and must come from `queue-receive`. Consumers must remain idempotent because queue delivery can repeat.

```ts
import { QueueClient } from '@harryy/ai-tools/queue'

const queue = QueueClient.fromAuth({
  provider: 'sqs',
  access_key_id,
  secret_access_key,
  region,
  queue_url
})
```
