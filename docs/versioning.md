# Versioning and release

Package: `@5ss/ai-tools`  
Tool: **[semantic-release](https://semantic-release.gitbook.io/)** on `main`.

## How it works

Every push to `main` that lands commits since the last tag cuts a release. Commit **type** only chooses the bump, never whether to release.

| Commit | Release |
| --- | --- |
| `feat:` / `feat(scope):` | **minor** |
| `BREAKING CHANGE:` in body or `type!:` | **major** |
| anything else (`fix:`, `chore:`, `docs:`, `test:`, `ci:`, `style:`, `build:`, `perf:`, `refactor:`, untyped) | **patch** |

```text
push to main
  → ci.yml           (check / build quality gate)
  → release.yml      (check + build + semantic-release)
       → analyze commits since last git tag
       → bump package.json, update CHANGELOG.md
       → git tag + GitHub Release
       → npm publish via OIDC Trusted Publisher (no NPM_TOKEN)
```

The bot `chore(release): … [skip ci]` commit is skipped in the workflow so that push cannot loop. If HEAD is already the latest tag (no new commits), semantic-release exits 0 and does nothing.

## One-time setup

### npm Trusted Publisher

1. npm package **`@5ss/ai-tools`** → **Trusted Publisher**
2. GitHub repo: **`5ss/ai-tools`** (exact)
3. Workflow file: **`release.yml`** (exact — not `ci.yml`, not `publish.yml`)
4. Permission: `npm publish`
5. Do **not** set repo secret `NPM_TOKEN` / `NODE_AUTH_TOKEN` for this workflow (empty token → `EINVALIDNPMTOKEN`). OIDC uses `id-token: write` only.
6. In `release.yml`, do **not** use `actions/setup-node` `registry-url` (it injects token auth into `.npmrc` and shadows OIDC).
7. `package.json` → `publishConfig.registry` must be exactly `https://registry.npmjs.org/` (**trailing slash**). Without it, `@semantic-release/npm` skips OIDC and demands `NPM_TOKEN`.

### Git tag for the version already on npm

`0.0.1` was published before semantic-release. Create a matching tag on the commit that matches that release so the next run does not re-publish `0.0.1`:

```bash
git tag v0.0.1 <commit-sha>   # if missing
git push origin v0.0.1
```

## Local

```bash
bun run release:dry    # dry-run (needs full git history + network for npm registry read)
bun run release        # real run — prefer CI; local needs npm auth
```

Prefer shipping via **merge to `main`** and let CI release.

## Commit style

```text
feat: add s3 copy object
fix: handle empty mime body
feat!: rename tool id weather-get

fix: correct list pagination

BREAKING CHANGE: listObjects no longer returns bare keys only.
```

Release commits from the bot look like:

```text
chore(release): 0.0.2 [skip ci]
```

Those do not trigger another release.

## Config

- `release.config.mjs` — plugins and rules  
- `.github/workflows/release.yml` — CI job  

## Public API (breaking = major)

Import paths, named exports, tool/module ids, auth field names, model-facing I/O fields, `ToolError.code`, false `runtime` claims.
