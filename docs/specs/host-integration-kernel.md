# Spec: Host-integration kernel (bind · context · hooks · catalog)

Status: **locked direction** (implementation slices land separately)  
Package: `@harryy/ai-tools`  
Date: 2026-07-26  

Related:

- [package-surface-architecture.md](./package-surface-architecture.md) — modules vs vendors  
- [provider-seam.md](./provider-seam.md) — multi-provider seams  
- [auth-and-binding](../guides/auth-and-binding.md) — host-owned secrets today (`withAuth`)  
- AGENTS.md — hard rules and **out of scope**  

---

## What this package is (and is not)

| This package **is** | This package **is not** |
| --- | --- |
| A **reusable tool-pack library** + small **host-integration kernel** | An **agent brain** or agent runtime |
| One authoring path for tools (`defineTool` / `defineModule`) | Multi-tenant policy, PHI routing, vaults, audit products |
| Host-bound auth, class clients, framework adapters | Confirmation UX, org RLS, model routing, chat delivery |
| Capability packs (seams + vendors) with stable kebab tool ids | Composio/Nango OAuth SaaS catalog replacement |
| Optional **catalog / on-demand discovery** helpers for large tool sets | Org connection intents, connector catalogs, “logical SaaS tools” |

**Host app** owns the agent brain: which tools an agent may use, tenancy, PHI gates, confirmation, durable runs, progress to the user, model choice.

**This package** owns portable tool definitions, transport clients, bind/run/project, and (when built) thin hooks and catalog helpers so hosts do not re-wrap every tool by hand.

Do **not** rebrand the package as “the agent brain.” That language pulls policy and orchestration into the wrong layer.

---

## Goals of the host-integration kernel

Make hosts able to:

1. Bind credentials **per invocation** (org, account, session) without putting secrets on model inputs.  
2. Pass **runtime context** (signal, host ids, progress, artifact sink handles) through adapters — not only `AbortSignal`.  
3. Inject **generic hooks** (before / onArtifact / after / onError) for host policy, artifact capture, and audit. The package does not implement delivery policy.  
4. Optionally **register** many tools and **discover / load on demand** so every agent turn does not attach hundreds of full schemas.  

Non-goals stay those in [package-surface-architecture.md](./package-surface-architecture.md) and AGENTS.md.

---

## On-demand tool discovery (in scope) vs Composio meta tools (out of scope)

### Problem we can solve in-package

Hosts may enable **dozens or hundreds** of first-party tools from this package (storage, messaging, commerce, …). Attaching every full JSON schema to every agent turn is expensive and confuses models.

**In-scope pattern: host-owned registry + small discovery surface over tools already registered for that agent.**

```text
Host builds registry from enabled packs (after bind/hooks)
        │
        ├─ Always attach: a few default tools + discovery helpers
        │     e.g. catalog-search-tools, catalog-read-tool
        │
        └─ On demand: host (or controlled execute helper) attaches
              full schema for tool ids the model selected
```

| Piece | Owner |
| --- | --- |
| Which modules/tools are **eligible** for an org/agent | **Host** |
| Credential resolve + context resolve | **Host** via bind APIs (kernel provides the pipe) |
| Catalog index (id, description, tags, sideEffect, runtime, schema digests) | **Package** helpers over registered `ToolDefinition`s |
| `search` / `read` by stable kebab id | **Package** (pure + optional Meta Tools projector) |
| Actually **execute** | Still `runTool` / bound execute — same auth, hooks, contracts |
| When to expand the active tool set mid-conversation | **Host** (or optional `execute_tool` that only runs **already bound** ids) |

This is **not** a second agent runtime. It is catalog + discovery over tools the host already chose to register.

### What Composio-style “meta tools” are (out of scope)

Composio / Nango (and similar) solve a **different** problem:

| Composio / connector catalog | This package’s on-demand catalog |
| --- | --- |
| Huge multi-app **SaaS OAuth** surface (Gmail, Sheets, CRMs, …) | First-party packs **this package owns** (or host registered) |
| Logical tools + connection intents + PHI routing path | No tenant OAuth product; no PHI router |
| “Search the world’s connectors” | “Search the tools I already enabled for this agent” |
| Host + Composio/Nango seam | Host + `@harryy/ai-tools` registry helpers |

**Locked:** do **not** reimplement Composio meta tools, connection catalogs, or OAuth app search in this package. Those stay host + Composio/Nango ([package-surface-architecture](./package-surface-architecture.md)).

If a design doc says “meta tools” without qualification, read it as **either**:

1. **In scope** — search/read (and maybe execute-by-id) over the **host-registered ai-tools set**, or  
2. **Out of scope** — Composio-style cross-app connector discovery  

Prefer names that do not collide: **catalog tools**, **tool discovery tools**, or **registry search** — not “Composio meta tools.”

### Suggested model-facing discovery tools (optional projector)

Names illustrative; ship only when product asks:

| Tool id (example) | Job |
| --- | --- |
| `catalog-search-tools` | Query registered tools by text / tags / sideEffect / runtime; return short list (id, description, tags) — **not** full schemas for everything |
| `catalog-read-tool` | Return full input/output schema + description for one **stable kebab id** already in the registry |
| `catalog-execute-tool` (optional, host-gated) | Execute one registered id with args; **must** use host bind + hooks; **must not** accept credentials in input |

Host may instead implement “load on demand” by expanding the Mastra/AI SDK tool map after `catalog-read-tool` without a package `execute` meta tool.

---

## Kernel direction

| Capability | Status | API |
| --- | --- | --- |
| Static auth bind | **Shipped** | `withAuth(module, creds)` |
| Dynamic auth / context | **Shipped (H-01)** | `bindModule(module, { resolveAuth, resolveContext?, hooks? })` |
| Adapter context | **Shipped (H-02)** | Adapter options: `context` + `createContext` (Mastra, AI SDK, TanStack, MCP, Cloudflare) |
| Hooks | **Shipped (H-03)** | `withHooks` / `withHooksTool` / hooks on `bindModule`, including structured-output `onArtifact` |
| Metadata | **Shipped (H-04)** | Additive `ToolMeta` hints + catalog fields |
| Catalog discovery tools | **Not shipped** | Registry search / `catalog-*` tools (H-05) — tabled |
| Execute path | **Shipped** | `runTool` — validate I/O, host auth, no secrets on model inputs |

---

## Host vs package (unchanged ownership)

| Concern | Package | Host |
| --- | --- | --- |
| Tool schemas, execute, errors | Yes | — |
| Provider HTTP / SigV4 clients | Yes | — |
| ArtifactRef validation, output discovery, bounded byte resolution | Yes | Storage binding + resolution limit |
| Channel attachment destination, upload, audit, and policy | — | Yes |
| Secret storage / vaults | — | Yes |
| Org tenancy / RLS / PHI | — | Yes |
| Agent allowlists / which tools enabled | — | Yes |
| Confirmation UX | — | Yes |
| Composio/Nango SaaS OAuth catalog | — | Yes |
| On-demand search over **registered ai-tools** | Helpers + optional tools | Registration + policy |
| Framework projection (Mastra, …) | Adapters | Composition |

---

## Acceptance for this doc

- Package is described as **tool packs + host-integration kernel**, never as agent brain / agent runtime.  
- On-demand tool discovery is **in scope** as catalog over host-registered tools.  
- Composio-style connector meta tools remain **out of scope**.  
- Implementation still requires an explicit product request per slice (bind, hooks, registry, discovery tools).
