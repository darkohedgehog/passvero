# Codex Task Workflow

## Before implementation

1. Read `codex/AGENTS.md`.
2. Read relevant files inside `codex/`.
3. Inspect:
   - package versions;
   - current folder structure;
   - existing conventions;
   - active configuration files;
   - current scripts.
4. Identify conflicts or missing prerequisites.
5. Produce a concise implementation plan.

## During implementation

- work only within requested scope;
- make small coherent changes;
- preserve existing behavior;
- avoid speculative features;
- do not create duplicate abstractions;
- do not replace working configuration without reason;
- keep code build-safe after each logical step.

## When architecture is unclear

Prefer the smallest design consistent with:

- current requirements;
- organization isolation;
- multilingual support;
- future product versioning.

Document non-obvious decisions in `codex/DECISIONS.md` when the task materially changes architecture.

## When requirements conflict

Priority order:

1. user’s current explicit request;
2. `codex/AGENTS.md`;
3. other project rules inside `codex/`;
4. existing repository conventions;
5. framework defaults.

Do not silently ignore conflicts. Report them.

## Final response format

Use this structure:

```md
## Summary

## Files created

## Files modified

## Verification

## Assumptions

## Remaining issues
```

Include exact command results.

Do not state “all good” without supporting checks.
