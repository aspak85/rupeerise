param([string]$Email = "admin@rupeerise.local", [Parameter(Mandatory=$true)][string]$Code)

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

Step "verify admin OTP" {
  $body = @{ email = $Email; code = $Code } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Method Post -Uri "$base/auth/verify-otp" -ContentType "application/json" -Body $body
  $token = $r.token
  $token | Out-File -Encoding ascii -NoNewline "$env:TEMP\rr_admin_token.txt"
  Write-Host "user.email = $($r.user.email)"
  Write-Host "user.role  = $($r.user.role)" -ForegroundColor $(if ($r.user.role -eq 'admin') {'Green'} else {'Red'})
}

$token = Get-Content "$env:TEMP\rr_admin_token.txt" -Raw
$headers = @{ Authorization = "Bearer $token" }

Step "GET /admin/stats" {
  $s = Invoke-RestMethod -Uri "$base/admin/stats" -Headers $headers
  Write-Host ("users={0} activeInvestments={1} pendingDeposits={2} pendingWithdrawals={3}" -f $s.users, $s.activeInvestments, $s.pendingDeposits, $s.pendingWithdrawals)
}

Step "GET /admin/users" {
  $u = Invoke-RestMethod -Uri "$base/admin/users" -Headers $headers
  Write-Host "users in db = $($u.users.Count)"
  $u.users | Select-Object -First 5 | ForEach-Object { "  - $($_.email)  [$($_.role)]  $($_.referralCode)" }
}

Step "GET /admin/deposits?status=pending" {
  $d = Invoke-RestMethod -Uri "$base/admin/deposits?status=pending" -Headers $headers
  Write-Host "pending deposits = $($d.deposits.Count)"
  $d.deposits | Select-Object -First 3 | ForEach-Object { "  - $($_.id)  user=$($_.User.email)  ₹$($_.amount)  utr=$($_.utr)" }
}

Step "GET /admin/withdrawals" {
  $w = Invoke-RestMethod -Uri "$base/admin/withdrawals" -Headers $headers
  Write-Host "withdrawals = $($w.withdrawals.Count)"
}

Step "GET /admin/plans" {
  $p = Invoke-RestMethod -Uri "$base/admin/plans" -Headers $headers
  Write-Host "plans = $($p.plans.Count)"
  $p.plans | ForEach-Object { "  - $($_.name)  ₹$($_.price)  daily ₹$($_.dailyIncome)  duration=$($_.durationDays)d  active=$($_.active)" }
}

Step "GET /admin/activity" {
  $a = Invoke-RestMethod -Uri "$base/admin/activity" -Headers $headers
  Write-Host "recentDeposits=$($a.recentDeposits.Count) recentWithdrawals=$($a.recentWithdrawals.Count) recentUsers=$($a.recentUsers.Count)"
}

Write-Host ""
Write-Host "──────────── ADMIN AUDIT COMPLETE ────────────" -ForegroundColor Green
