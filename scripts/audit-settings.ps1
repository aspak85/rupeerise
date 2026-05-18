$ErrorActionPreference = "Stop"
$base = "http://localhost:4000"
$AdminEmail = "admin@rupeerise.local"

function Step($name, $block) {
  Write-Host ""
  Write-Host "-- $name --" -ForegroundColor Cyan
  try { & $block } catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
}

Step "1. Login as admin" {
  $body = @{ email = $AdminEmail } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Method Post -Uri "$base/auth/request-otp" -ContentType "application/json" -Body $body
  if (-not $r.devOtp) { throw "no devOtp returned" }
  $verifyBody = @{ email = $AdminEmail; code = $r.devOtp } | ConvertTo-Json -Compress
  $v = Invoke-RestMethod -Method Post -Uri "$base/auth/verify-otp" -ContentType "application/json" -Body $verifyBody
  if ($v.user.role -ne "admin") { throw "Logged in user is not admin (role=$($v.user.role))" }
  $global:ADMIN_TOKEN = $v.token
  Write-Host "Admin token acquired" -ForegroundColor Green
}

$headers = @{ Authorization = "Bearer $($global:ADMIN_TOKEN)" }

Step "2. GET /admin/settings/status" {
  $r = Invoke-RestMethod -Uri "$base/admin/settings/status" -Headers $headers
  Write-Host "smtp.configured     = $($r.smtp.configured)"
  Write-Host "smtp.host           = $($r.smtp.host)"
  Write-Host "smtp.user (masked)  = $($r.smtp.user)"
  Write-Host "smtp.vendor         = $($r.smtp.vendor)"
  Write-Host "razorpay.configured = $($r.razorpay.configured)"
  Write-Host "razorpay.mode       = $($r.razorpay.mode)"
  Write-Host "admins              = $($r.admins -join ', ')"
}

Step "3. POST /admin/settings/test-mail (no SMTP configured -> dev console only)" {
  $body = @{ to = "test@rupeerise.local" } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Method Post -Uri "$base/admin/settings/test-mail" -Headers $headers -ContentType "application/json" -Body $body
  Write-Host ("ok={0} delivered={1}" -f $r.ok, $r.delivered)
  Write-Host ("message: {0}" -f $r.message)
  if (-not $r.ok) { throw "test-mail responded ok=false" }
}

Step "4. Non-admin cannot access /admin/settings/status" {
  $u = "regular.audit@rupeerise.local"
  $b = @{ email = $u } | ConvertTo-Json -Compress
  $req = Invoke-RestMethod -Method Post -Uri "$base/auth/request-otp" -ContentType "application/json" -Body $b
  $v = Invoke-RestMethod -Method Post -Uri "$base/auth/verify-otp" -ContentType "application/json" -Body (@{ email=$u; code=$req.devOtp } | ConvertTo-Json -Compress)
  if ($v.user.role -eq "admin") { Write-Host "Skip: regular user happens to be admin" -ForegroundColor Yellow; return }
  $userHeaders = @{ Authorization = "Bearer $($v.token)" }
  try {
    Invoke-RestMethod -Uri "$base/admin/settings/status" -Headers $userHeaders | Out-Null
    throw "Unexpected: regular user could access /admin/settings/status"
  } catch {
    $resp = $_.Exception.Response
    if ($resp -and ($resp.StatusCode.value__ -eq 401 -or $resp.StatusCode.value__ -eq 403)) {
      Write-Host "Properly blocked (HTTP $($resp.StatusCode.value__))" -ForegroundColor Green
    } else {
      throw
    }
  }
}

Write-Host ""
Write-Host "============ SETTINGS AUDIT COMPLETE ============" -ForegroundColor Green
