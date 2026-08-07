# `@5ss/ai-tools/core`

Kernel: define tools/modules, validate contracts, bind auth, run tools, catalog, JSON Schema.

## Install surface

```ts
import {
  defineTool,
  defineModule,
  withAuth,
  withAuthTool,
  runTool,
  listTools,
  validateModule,
  validateTool,
  assertContracts,
  toModuleCatalogEntry,
  toToolCatalogEntry,
  resolveTools,
  filterToolsByRuntime,
  ToolError,
  isToolError,
} from '@5ss/ai-tools/core'
```

## `defineTool`

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Stable kebab-case (`weather-get`) |
| `name` | yes | Friendly name |
| `description` | yes | Model-facing capability copy |
| `inputSchema` | yes | Zod schema (Zod 4) |
| `outputSchema` | yes | Zod schema |
| `execute` | yes | `(input, ctx) => Promise<output>` after input parse |
| `sideEffect` | optional | defaults via meta; set explicitly in modules |
| `runtime` | optional | `both` \| `edge` \| `node` |
| `tags` | optional | free-form tags |
| `idempotent`, `longRunning`, `requiresConfirmation`, `supportsCancel`, `supportsProgress`, `network`, `artifacts` | optional | host-facing **hints** only (not enforced) |

`defineTool` wraps execute so **input** is validated before your function runs. **Output** is validated by `runTool` (and adapters that use `runTool`), not by calling `.execute` directly — intentional so adapters and tests can share one path.

## `defineModule`

| Field | Notes |
| --- | --- |
| `id` | Stable module id |
| `title` | Display title |
| `description` | Module summary |
| `runtime` | Module-level runtime claim |
| `auth` | `{ type: 'none' }` or `{ type: 'custom', schema }` (and other auth kinds) |
| `tools` | `readonly ToolDefinition[]` |

## Auth helpers

- `withAuth(module, credentials)` → static bound module
- `withAuthTool(tool, credentials)` → static bound tool
- `bindModule(module, { resolveAuth, resolveContext?, hooks? })` → per-invocation auth/context
- `bindTool(tool, moduleAuth, options)` → single-tool dynamic bind
- `withHooks(module, hooks)` / `withHooksTool(tool, hooks)` → before/onArtifact/after/onError pipes
- `listTools(moduleOrTools)` → flat tool list

## Execution

```ts
await runTool(tool, input, ctx?)
```

Validates input, resolves bound context, executes the leaf, and validates output
against `outputSchema`. It then calls `onArtifact` once for each unique
`ArtifactRef` found in the structured output, followed by `afterExecute`. Errors
from execution, validation, artifact capture, or after hooks reach `onError`.
Every hook phase sees the same resolved context.

## Contracts

```ts
validateTool(tool)   // { ok, issues }
validateModule(mod)
assertContracts(mod) // throws if invalid
```

Enforces model-facing description quality, schema presence, id shape, and related rules used in tests.

## Catalog

```ts
toToolCatalogEntry(tool)
toModuleCatalogEntry(module)
```

Host UIs / registries can list tools without executing them.

## JSON Schema

Adapters use Zod's `toJSONSchema` for host tool parameters (MCP, Cloudflare AI, catalogs).

## Errors

See [Errors guide](../guides/errors.md).

## Related

- [Getting started](../guides/getting-started.md)
- [Auth and binding](../guides/auth-and-binding.md)
