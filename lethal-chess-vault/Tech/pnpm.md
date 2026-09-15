---
tags: [tech]
aliases: [pnpm]
---

# pnpm

pnpm 11.5.2 (from the NixOS system, not a project-local install).

## The one gotcha that cost time

**pnpm 11 no longer reads the `pnpm` field in `package.json`.** Settings moved to
`pnpm-workspace.yaml`. Putting `onlyBuiltDependencies` in `package.json` is silently ignored with
only a `[WARN]`, and the install still fails.

Worse: an ignored install script is a **hard failure** (`ERR_PNPM_IGNORED_BUILDS`, exit 1), which
breaks any script with a `prepare`/`pre*` hook — `pnpm check` included. The fix is to declare intent
explicitly:

```yaml
# pnpm-workspace.yaml
allowBuilds:
  stockfish: false
```

pnpm will write a placeholder (`stockfish: set this to true or false`) into that file itself if you
leave it undeclared. See [[Stockfish]] for why the answer is `false`.

Related: [[Stack (MOC)]]
