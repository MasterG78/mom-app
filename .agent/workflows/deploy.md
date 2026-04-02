---
description: Deploy both front-end and Supabase backend changes
---

This workflow is used when the user says "deploy". It handles syncing local changes to GitHub, building and deploying the frontend to GH Pages, pushing Supabase migrations, and deploying all edge functions.

### Steps

1. **Check Migration Status**
   Check if there are any outstanding migrations before proceeding.
   ```bash
   supabase db status
   ```

2. **Push Git Commits**
   Ensure all local commits are pushed to the remote repository.
   ```bash
   git push origin main
   ```

3. **Deploy Frontend**
   Build the application and deploy it to GitHub Pages.
   ```bash
   npm run deploy
   ```

4. **Migrate Supabase Database**
   Push any pending sql migrations to the production environment.
   ```bash
   supabase db push
   ```

5. **Deploy Edge Functions**
   Deploy all Supabase edge functions to the production environment.
   ```bash
   supabase functions deploy
   ```

6. **Create Git Checkpoint Tag**
   Tag the current commit with a timestamp to mark the deployment state.
   ```powershell
   $tag = "checkpoint-$(Get-Date -Format 'yyyy-MM-dd-HHmm')"
   git tag $tag
   git push origin $tag
   ```

> [!CAUTION]
> As per `.cursorrules`, none of these commands should be set to `SafeToAutoRun=true`. Each step must be explicitly reviewed and confirmed by the user.
