param([string]$Email = "audit@rupeerise.local", [string]$Code)

$ErrorActionPreference = "Stop"
$base = "http://localhost:4000"

function Step($name, $block) {
  Write-Host ""
  Write-Host "── $name ──" -ForegroundColor Cyan
  try { & $block } catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
}

Step "1. GET /health" {
  $h = Invoke-RestMethod -Uri "$base/health"
  $h | ConvertTo-Json -Compress
}

if (-not $Code) {
  Step "2. POST /auth/request-otp" {
    $body = @{ email = $Email } | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Method Post -Uri "$base/auth/request-otp" -ContentType "application/json" -Body $body
    $r | ConvertTo-Json -Compress
  }
  Write-Host ""
  Write-Host "Now grab the OTP from the API console (printed above) and re-run with -Code <6digits>" -ForegroundColor Yellow
  exit 0
}

Step "3. POST /auth/verify-otp" {
  $body = @{ email = $Email; code = $Code } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Method Post -Uri "$base/auth/verify-otp" -ContentType "application/json" -Body $body
  $token = $r.token
  $token | Out-File -Encoding ascii -NoNewline "$env:TEMP\rr_token.txt"
  Write-Host "user.email = $($r.user.email)" -ForegroundColor Green
  Write-Host "user.role  = $($r.user.role)"  -ForegroundColor Green
  Write-Host "token saved to $env:TEMP\rr_token.txt"
}

$token = Get-Content "$env:TEMP\rr_token.txt" -Raw
$headers = @{ Authorization = "Bearer $token" }

Step "4. GET /me" {
  $me = Invoke-RestMethod -Uri "$base/me" -Headers $headers
  Write-Host "user.email   = $($me.user.email)"
  Write-Host "wallets      = $($me.wallets.Count) provisioned"
  Write-Host "total balance = $($me.totals.total)"
}

Step "5. GET /plans" {
  $p = Invoke-RestMethod -Uri "$base/plans"
  Write-Host "plans = $($p.plans.Count) | fallback = $($p.fallback)"
  $p.plans | ForEach-Object { "  - $($_.name)  ₹$($_.price)  daily ₹$($_.dailyIncome)" }
}

Step "6. GET /claims/status" {
  $c = Invoke-RestMethod -Uri "$base/claims/status" -Headers $headers
  Write-Host "claimedToday = $($c.claimedToday) | pending = $($c.pendingAmount)"
}

Step "7. GET /referrals/me" {
  $r = Invoke-RestMethod -Uri "$base/referrals/me" -Headers $headers
  Write-Host "referralCode = $($r.code) | l1/l2/l3 = $($r.counts.l1)/$($r.counts.l2)/$($r.counts.l3)"
}

Step "8. POST /deposits  (submit ₹500 manual UTR)" {
  $body = @{ amount = 500; method = "manual_utr"; utr = "AUDIT123456" } | ConvertTo-Json -Compress
  $d = Invoke-RestMethod -Method Post -Uri "$base/deposits" -Headers $headers -ContentType "application/json" -Body $body
  Write-Host "deposit.id = $($d.deposit.id) | status = $($d.deposit.status)"
}

Step "9. /me/* surface (investments, withdrawals/history)" {
  $inv = Invoke-RestMethod -Uri "$base/investments" -Headers $headers
  $wd  = Invoke-RestMethod -Uri "$base/withdrawals" -Headers $headers
  Write-Host "investments = $($inv.investments.Count) | withdrawals = $($wd.withdrawals.Count)"
}

Write-Host ""
Write-Host "──────────── AUDIT COMPLETE ────────────" -ForegroundColor Green
