# AI Rules of Engagement & Guardrails

This document defines the persistent rules that all AI assistants (e.g., Antigravity, Cursor, etc.) MUST follow when working on this repository.

## 1. Deployment Guardrails
- **NEVER** set `SafeToAutoRun` to `true` for any command that triggers a deployment (e.g., `gh-pages`, `firebase deploy`, `supabase deploy`, `git push origin production`, etc.).
- The user **MUST** manually approve every deployment workflow.
- If a task involves deployment, always pause and explicitly ask for confirmation before executing the final step.
- **COMMUNICATION**: Always clearly state when changes are "local-only" or "not yet deployed" in your status updates and walkthroughs.

## 2. Low-Friction Development & Testing
- Routine development actions (e.g., `ls`, `grep`, `npm run build`, `npm run dev`) are authorized for `SafeToAutoRun`.
- Avoid unnecessary interruptions (`notify_user`) for non-critical ambiguities or style decisions; make a reasonable assumption and document it.
- **AUTHENTICATION**: Before performing browser-based UI tests, always check [TESTING_AUTH.md](file:///c:/projects/supabase/mom/mom-app/TESTING_AUTH.md) for dedicated AI test credentials. Use these to log in and avoid requesting one-time codes or workarounds.



## 3. High-Risk Operations
The following actions should ALWAYS be preceded by a research phase and a plan:
- Deleting multiple files or entire directories.

- Dropping or truncating database tables.
- Modifying authentication or security policies (`supabase/migrations`, RBAC logic).
- Changing global project settings in `.vscode`, `vite.config.js`, or `package.json`.

---
*These rules are persistent and supercede any verbal instructions in a single conversation unless explicitly overridden by the USER in that conversation.*
