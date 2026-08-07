# Skills

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/skills` |
| **Kind** | capability **module** (`src/modules/skills`) |
| **Module id** | `skills` |
| **Auth** | Host: `{ skills: SkillDefinition[] }` — resolved catalog for this bind |
| **Tools** | `skills-list`, `skills-get`, `skills-search` |

Portable skill definitions (instructions + required tool ids/tags). **Org assignment, persistence, and authZ stay on the host.** This pack only searches and loads a catalog the host already bound.

## Tools

| id | Role |
| --- | --- |
| `skills-list` | Summaries only (no full instructions); optional tag filter |
| `skills-get` | Full skill by id |
| `skills-search` | Free-text + optional tags → ranked summaries |

## Bind

```ts
withAuth(skillsModule, {
  skills: [
    {
      id: 'summarize-docs',
      title: 'Summarize documents',
      description: 'Summarize long documents into bullet points',
      instructions: '…',
      required_tool_ids: ['document-read'],
      tags: ['docs'],
    },
  ],
})
```

## Non-goals

- Creating or editing org skills  
- Assigning skills to agents  
- Fetching skills from a remote store (host does that before bind)  
