# Scheduler

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/scheduler` |
| **Kind** | capability **seam** (`src/modules/scheduler`) |
| **Module id** | `scheduler` |
| **Provider** | `eventbridge` |
| **Tools** | create, update, get, list, delete |

Provider-neutral schedule tools over the bound scheduler. Schedules point to an opaque `task_ref`; infrastructure targets remain in host auth.

## Bind

```ts
withAuth(schedulerModule, {
  provider: 'eventbridge',
  access_key_id: '…',
  secret_access_key: '…',
  region: 'us-east-1',
  target_arn: 'arn:aws:lambda:…:function:runner',
  role_arn: 'arn:aws:iam::…:role/scheduler',
  group_name: 'default',
})
```

The EventBridge provider wraps the full vendor client. The seam owns only shared schedule verbs and capability tool ids.

Updates are full replacements because that is the current provider contract. Read the current schedule before updating when omitted fields must be retained.
