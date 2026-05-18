param(
  [string]$Sponsor = "sponsor.audit@rupeerise.local",
  [string]$Invitee = "invitee.audit@rupeerise.local"
)

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

function Otp([string]$email) {
  $body = @{ email = $email } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Method Post -Uri "$base/auth/request-otp" -ContentType "application/json" -Body $body
  if (-not $r.devOtp) { throw "no devOtp returned (SMTP_HOST may be set)" }
  return $r.devOtp
}

function VerifyAndSignIn([hashtable]$body) {
  $json = $body | ConvertTo-Json -Compress
  return Invoke-RestMethod -Method Post -Uri "$base/auth/verify-otp" -ContentType "application/json" -Body $json
}

# ========== SPONSOR: signup, get referral code ==========
Step "1. Sponsor request-otp + verify (signup as new user)" {
  $code = Otp $Sponsor
  $res = VerifyAndSignIn @{ email = $Sponsor; code = $code; firstName = "Sponsor"; lastName = "User"; phone = "9000000001" }
  if (-not $res.isNewAccount) { Write-Host "(account already existed)" -ForegroundColor Yellow }
  $global:SPONSOR_TOKEN = $res.token
  $global:SPONSOR_CODE  = $res.user.referralCode
  if (-not $res.user.firstName -or -not $res.user.lastName) { throw "firstName/lastName missing in /verify-otp response" }
  Write-Host ("first/last = {0} {1}" -f $res.user.firstName, $res.user.lastName)
  Write-Host ("ref code   = {0}" -f $global:SPONSOR_CODE) -ForegroundColor Green
}

# ========== INVITEE: signup with sponsor referralCode ==========
Step "2. Invitee signup using sponsor's referralCode" {
  $code = Otp $Invitee
  $res = VerifyAndSignIn @{
    email = $Invitee; code = $code
    firstName = "Invitee"; lastName = "User"
    phone = "9000000002"
    referralCode = $global:SPONSOR_CODE
  }
  $global:INVITEE_TOKEN = $res.token
  if (-not $res.user.firstName) { throw "invitee firstName missing" }
  Write-Host ("invitee = {0} {1}" -f $res.user.firstName, $res.user.lastName)
}

# ========== SPONSOR /referrals/me should now show invitee at L1 ==========
Step "3. Sponsor: GET /referrals/me (invitee should appear in L1)" {
  $h = @{ Authorization = "Bearer $($global:SPONSOR_TOKEN)" }
  $r = Invoke-RestMethod -Uri "$base/referrals/me" -Headers $h
  Write-Host ("L1 count = {0}, L2 = {1}, L3 = {2}" -f $r.counts.l1, $r.counts.l2, $r.counts.l3)
  if ($r.counts.l1 -lt 1) { throw "Expected at least 1 L1 invitee in sponsor's team" }
  Write-Host "Referral edge materialized OK" -ForegroundColor Green
}

# ========== PLANS: should be 7 now, including Emperor ==========
Step "4. GET /plans (should include 7 plans up to Emperor)" {
  $r = Invoke-RestMethod -Uri "$base/plans"
  Write-Host ("plan count = {0}" -f $r.plans.Count)
  $names = ($r.plans | ForEach-Object { $_.name }) -join ", "
  Write-Host "names: $names"
  if ($r.plans.Count -ne 7) { throw "Expected 7 plans, got $($r.plans.Count)" }
  $emperor = $r.plans | Where-Object { $_.name -eq "Emperor" }
  if (-not $emperor) { throw "Emperor plan missing" }
  if ($emperor.price -ne 100000) { throw "Emperor price wrong: $($emperor.price)" }
  Write-Host "Plans OK" -ForegroundColor Green
}

# ========== DEPOSITS: /deposits/config + razorpay stub behavior ==========
Step "5. Invitee: GET /deposits/config" {
  $h = @{ Authorization = "Bearer $($global:INVITEE_TOKEN)" }
  $r = Invoke-RestMethod -Uri "$base/deposits/config" -Headers $h
  Write-Host ("razorpay.enabled = {0}, upiId = {1}, minDeposit = {2}" -f $r.razorpay.enabled, $r.upiId, $r.minDeposit)
}

Step "6. Invitee: POST /deposits/razorpay/order (when keys missing, must return stub error)" {
  $h = @{ Authorization = "Bearer $($global:INVITEE_TOKEN)" }
  $body = @{ amount = 1000 } | ConvertTo-Json -Compress
  try {
    $r = Invoke-RestMethod -Method Post -Uri "$base/deposits/razorpay/order" -Headers $h -ContentType "application/json" -Body $body
    Write-Host "Unexpected success when Razorpay should not be configured: $($r | ConvertTo-Json -Compress)" -ForegroundColor Yellow
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $sr = New-Object System.IO.StreamReader $resp.GetResponseStream()
      $body = $sr.ReadToEnd()
      Write-Host "Expected stub error returned: $body" -ForegroundColor Green
    } else {
      throw
    }
  }
}

# ========== DEPOSITS: manual UTR submit (always works) ==========
Step "7. Invitee: POST /deposits (manual UTR pending)" {
  $h = @{ Authorization = "Bearer $($global:INVITEE_TOKEN)" }
  $body = @{ amount = 500; method = "manual_utr"; utr = "AUDIT123456" } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Method Post -Uri "$base/deposits" -Headers $h -ContentType "application/json" -Body $body
  if (-not $r.ok) { throw "manual deposit failed" }
  Write-Host ("deposit id = {0}, status = {1}" -f $r.deposit.id, $r.deposit.status) -ForegroundColor Green
}

# ========== /me should reflect names and wallets ==========
Step "8. Invitee: GET /me (names persisted, wallets present)" {
  $h = @{ Authorization = "Bearer $($global:INVITEE_TOKEN)" }
  $r = Invoke-RestMethod -Uri "$base/me" -Headers $h
  Write-Host ("name = '{0} {1}'  wallets = {2}" -f $r.user.firstName, $r.user.lastName, $r.wallets.Count)
  if (-not $r.user.firstName -or -not $r.user.lastName) { throw "user names not persisted" }
  if ($r.wallets.Count -lt 5) { throw "Expected 5 wallets, got $($r.wallets.Count)" }
  Write-Host "OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "============ AUDIT v2 COMPLETE ============" -ForegroundColor Green
