# scripts/deploy.ps1
# Master Deployment Script for Mountain Oak Mill (MOM) App

Write-Host "Starting Full Deployment Process..." -ForegroundColor Cyan

# 1. Git Validation & Auto-Commit
Write-Host "Checking Git state..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    Write-Host "Unsaved changes detected. Auto-committing for you..." -ForegroundColor Cyan
    git add .
    git commit -m "Deploy sync: Auto-saving changes before deployment [$(Get-Date -Format 'yyyy-MM-dd HH:mm')]"
} else {
    Write-Host "Git branch is clean." -ForegroundColor Green
}

# 2. Push to Branch
Write-Host "Pushing changes to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Error "Git push failed. Aborting."
    exit 1
}

# 3. Supabase Health Check
Write-Host "Checking Database Migration Status..." -ForegroundColor Yellow
supabase db status
if ($LASTEXITCODE -ne 0) {
    Write-Host "Database status check failed or reported drift." -ForegroundColor Red
    exit 1
}

# 4. Frontend Deployment
Write-Host "Building and Deploying Frontend (GitHub Pages)..." -ForegroundColor Yellow
npm run deploy
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend deployment (npm run deploy) failed."
    exit 1
}

# 5. Database Migration Push
Write-Host "Pushing Database Migrations to Production..." -ForegroundColor Yellow
# Note: Handle interactive prompt if it appears
supabase db push
if ($LASTEXITCODE -ne 0) {
    Write-Error "Database migration push failed."
    exit 1
}

# 6. Edge Functions
Write-Host "Deploying Edge Functions..." -ForegroundColor Yellow
supabase functions deploy
if ($LASTEXITCODE -ne 0) {
    Write-Error "Edge function deployment failed."
    exit 1
}

# 7. Final Checkpoint Tag
$tag = "checkpoint-$(Get-Date -Format 'yyyy-MM-dd-HHmm')"
Write-Host "Creating Checkpoint Tag: $tag" -ForegroundColor Yellow
git tag $tag
git push origin $tag

Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "Environment: Production"
Write-Host "Tag: $tag"
