---
name: fix
description: Run typechecking and linting, then spawn parallel agents to fix all issues
---

# Project Code Quality Check

## Step 1: Run Linting and Typechecking

```bash
npm run typecheck
npm run lint:check
npm run format:check
```

## Step 2: Collect and Parse Errors

Parse the output from the commands. Group errors by domain:

- **Type errors**: TypeScript issues from `tsc`
- **Lint errors**: ESLint issues
- **Format errors**: Prettier issues

Create a list of all files with issues and specific problems in each file.

## Step 3: Spawn Parallel Agents

For each domain with issues, spawn an agent in parallel using the Task tool.

**IMPORTANT**: Use a SINGLE response with MULTIPLE Task tool calls to run agents in parallel.

- Spawn a "type-fixer" agent for type errors
- Spawn a "lint-fixer" agent for lint errors
- Spawn a "format-fixer" agent for formatting errors (or run `npm run format`)

Each agent should:

1. Receive the list of files and specific errors
2. Fix all errors in their domain
3. Run the relevant check to verify fixes
4. Report completion

## Step 4: Verify All Fixes

After all agents complete, run:

```bash
npm run check
```

Ensure all issues are resolved.
