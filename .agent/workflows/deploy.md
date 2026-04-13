---
description: Deploy both front-end and Supabase backend changes
---

This workflow is used when the user says "deploy". It handles syncing local changes to GitHub, building and deploying the frontend to GH Pages, pushing Supabase migrations, and deploying all edge functions.

### Steps

1. **Run Full Deployment**
   Execute the master deployment script. This handles git syncing, health checks, and deploying all components (web, database, functions).
   ```bash
   powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1
   ```

> [!CAUTION]
> As per `.cursorrules`, none of these commands should be set to `SafeToAutoRun=true`. Each step must be explicitly reviewed and confirmed by the user.
