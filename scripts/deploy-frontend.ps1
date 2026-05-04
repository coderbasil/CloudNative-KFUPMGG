<#
.SYNOPSIS
    Build the React frontend and deploy it to S3 + invalidate CloudFront.
    Reads the bucket name and distribution ID from Terraform outputs.
    Run "terraform apply" in infra/ first if the stack doesn't exist yet.

.EXAMPLE
    .\scripts\deploy-frontend.ps1
#>

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

# ── 1. Read Terraform outputs ─────────────────────────────────────────────────
Write-Host "Reading Terraform outputs..."
Push-Location "$root\infra"
try {
    $bucket  = terraform output -raw frontend_bucket
    $distId  = terraform output -raw frontend_distribution_id
    $siteUrl = terraform output -raw frontend_url
} finally {
    Pop-Location
}

Write-Host "Bucket : $bucket"
Write-Host "Dist ID: $distId"

# ── 2. Build the React app ────────────────────────────────────────────────────
Write-Host "Building frontend..."
Push-Location "$root\client"
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed." }
} finally {
    Pop-Location
}

# ── 3. Sync to S3 ─────────────────────────────────────────────────────────────
Write-Host "Syncing to s3://$bucket ..."
aws s3 sync "$root\client\build" "s3://$bucket" --delete --region eu-north-1
if ($LASTEXITCODE -ne 0) { throw "S3 sync failed." }

# ── 4. Invalidate CloudFront cache ────────────────────────────────────────────
Write-Host "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id $distId --paths "/*" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "CloudFront invalidation failed." }

Write-Host ""
Write-Host "Done! Live at: $siteUrl"
