param([string]$Email = "rewards@rupeerise.local")

$ErrorActionPreference = "Stop"
$base = "http://localhost:4000"

function Step($name, $block) {
  Write-Host ""
  Write-Host "-- $name --" -ForegroundColor Cyan
  try { & $block } catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
}

Step "1. request-otp (dev mode returns OTP in body)" {
  $body = @{ email = $Email } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Method Post -Uri "$base/auth/request-otp" -ContentType "application/json" -Body $body
  $r | ConvertTo-Json -Compress
  if (-not $r.devOtp) {
    Write-Host "Expected devOtp in response but missing" -ForegroundColor Red
    exit 1
  }
  $global:OTP = $r.devOtp
  Write-Host "got devOtp = $($global:OTP)" -ForegroundColor Green
}

Step "2. verify-otp" {
  $body = @{ email = $Email; code = $global:OTP } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Method Post -Uri "$base/auth/verify-otp" -ContentType "application/json" -Body $body
  $global:TOKEN = $r.token
  Write-Host "logged in as $($r.user.email)" -ForegroundColor Green
}

$headers = @{ Authorization = "Bearer $($global:TOKEN)" }

Step "3. GET /rewards/status (both should be available)" {
  $r = Invoke-RestMethod -Uri "$base/rewards/status" -Headers $headers
  Write-Host "spin.available    = $($r.spin.available)"
  Write-Host "scratch.available = $($r.scratch.available)"
  Write-Host "msUntilNext       = $($r.msUntilNext)"
}

Step "4. POST /rewards/spin (claim once)" {
  $r = Invoke-RestMethod -Method Post -Uri "$base/rewards/spin" -Headers $headers
  Write-Host "alreadyClaimed = $($r.alreadyClaimed)"
  Write-Host "amount         = $($r.amount)"
  Write-Host "index          = $($r.index)"
}

Step "5. POST /rewards/spin (idempotent second time)" {
  $r = Invoke-RestMethod -Method Post -Uri "$base/rewards/spin" -Headers $headers
  if (-not $r.alreadyClaimed) {
    Write-Host "Expected idempotent claim but got fresh credit!" -ForegroundColor Red
    exit 1
  }
  Write-Host "idempotent OK -- alreadyClaimed=$($r.alreadyClaimed) amount=$($r.amount)" -ForegroundColor Green
}

Step "6. POST /rewards/scratch (claim once)" {
  $r = Invoke-RestMethod -Method Post -Uri "$base/rewards/scratch" -Headers $headers
  Write-Host "amount = $($r.amount) alreadyClaimed = $($r.alreadyClaimed)"
}

Step "7. POST /rewards/scratch (idempotent)" {
  $r = Invoke-RestMethod -Method Post -Uri "$base/rewards/scratch" -Headers $headers
  if (-not $r.alreadyClaimed) {
    Write-Host "Expected idempotent claim but got fresh credit!" -ForegroundColor Red
    exit 1
  }
  Write-Host "idempotent OK" -ForegroundColor Green
}

Step "8. GET /me (verify bonus wallet credited)" {
  $r = Invoke-RestMethod -Uri "$base/me" -Headers $headers
  $bonus = $r.totals.byType.bonus
  Write-Host "bonus wallet balance = $bonus"
  if ($bonus -le 0) {
    Write-Host "Expected bonus > 0 after spin+scratch!" -ForegroundColor Red
    exit 1
  }
  Write-Host "bonus credited correctly OK" -ForegroundColor Green
}

Step "9. GET /rewards/status (both should now be unavailable)" {
  $r = Invoke-RestMethod -Uri "$base/rewards/status" -Headers $headers
  Write-Host "spin.available    = $($r.spin.available) (claimed $($r.spin.claimedAmount))"
  Write-Host "scratch.available = $($r.scratch.available) (claimed $($r.scratch.claimedAmount))"
}

Write-Host ""
Write-Host "============ REWARDS AUDIT COMPLETE ============" -ForegroundColor Green
