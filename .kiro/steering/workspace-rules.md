---
inclusion: always
---

# Workspace Rules

## Editing Boundaries
- ALL code edits, file creation, and file deletion MUST happen in the `1Build/` folder only.
- NEVER directly edit files in `2RuntimeProject/`. That folder is read-only for reference and running the app.
- When the user wants to test changes, copy the modified files from `1Build/` to `2RuntimeProject/` using the sync/copy approach — do not edit `2RuntimeProject/` source files directly.

## Workflow
1. Make all changes in `1Build/`
2. When ready to test, copy changed source files to `2RuntimeProject/`
3. Run `npm run dev` in `2RuntimeProject/` to test

## What lives where
- `1Build/` — source of truth for all code, data, and assets
- `2RuntimeProject/` — runtime environment (node_modules, .next, .env.local, build output)
