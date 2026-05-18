$conns = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
if (-not $conns) { Write-Host "No listener on :4000"; exit 0 }
$procs = $conns.OwningProcess | Sort-Object -Unique
foreach ($procId in $procs) {
  try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Host ("killed pid {0}" -f $procId)
  } catch {
    Write-Host ("failed to kill {0}: {1}" -f $procId, $_.Exception.Message)
  }
}
Start-Sleep -Milliseconds 800
Write-Host "done"
