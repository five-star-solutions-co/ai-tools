# Tasks

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/tasks` |
| **Kind** | capability **seam** (`src/modules/tasks`) |
| **Module id** | `tasks` |
| **Provider** | `host` |
| **Tools** | create, get, list, update, delete |

Portable task-definition contracts backed by host callbacks. A created definition returns an opaque `task_ref` that a scheduler or host runtime can invoke later.

## Task definition

A definition contains:

- `task_ref`: opaque host reference
- `title`
- `instructions`
- optional default `payload`
- optional searchable `tags`
- optional host timestamps

## Bind

```ts
withAuth(tasksModule, {
  provider: 'host',
  backend: {
    create: async (input) => ({ task: await store.create(input) }),
    get: async ({ task_ref }) => ({ task: await store.get(task_ref) }),
    list: async (input) => store.list(input),
    update: async (input) => ({ task: await store.update(input) }),
    delete: async ({ task_ref }) => ({ task_ref, deleted: await store.delete(task_ref) }),
  },
})
```

The package validates every backend result. The host owns persistence, tenant authorization, execution, audit, retries, and deletion recovery.
