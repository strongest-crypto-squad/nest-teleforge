# Copilot Instructions for this workspace

## Testing policy

- By default, run only targeted tests for the files/features changed in the current task.
- Prefer the narrowest command first:
  - single test case (`pnpm test:case -- "..."` / `pnpm test:live:case -- "..."`)
  - then single test file (`pnpm test:file -- <path>` / `pnpm test:live:file -- <path>`)
- Do **not** run full suites (`pnpm test`, `pnpm test:live`) unless:
  - the user explicitly asks for full run, or
  - targeted tests are insufficient to validate the change.
- If full run is needed, explain briefly why before running it.

## Work style

- Keep changes minimal and scoped to the request.
- Avoid touching unrelated files.
- After edits, report exactly what was changed and which targeted tests were run.
