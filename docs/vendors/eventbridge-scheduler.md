# EventBridge Scheduler

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/eventbridge-scheduler` |
| **Kind** | vendor pack |
| **Auth** | AWS keys + host-bound `target_arn` / `role_arn` (+ optional group, DLQ, retries) |
| **Tools** | create / update / get / list / delete |

Model schedules a **task_ref** (opaque host task definition). Infrastructure ARNs stay in host auth.

Updates are full replacements, matching EventBridge Scheduler semantics. Read the current schedule before updating when optional fields must be retained.

## Bind

```ts
withAuth(eventBridgeSchedulerModule, {
  access_key_id: '…',
  secret_access_key: '…',
  region: 'us-east-1',
  target_arn: 'arn:aws:lambda:…:function:runner',
  role_arn: 'arn:aws:iam::…:role/scheduler',
  group_name: 'default', // optional
})
```
