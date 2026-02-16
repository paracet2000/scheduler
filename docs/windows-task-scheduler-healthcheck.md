# Windows Task Scheduler: Ping /api/health Every 10 Minutes

This repo exposes a health endpoint at `GET /api/health` (see `app.js`).

## 1) Run Manually (Smoke Test)

```powershell
cd E:\scheduler
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\utils\Invoke-HealthCheck.ps1" `
  -Url "https://YOUR_HOST/api/health"
```

Logs are appended to `logs\healthcheck\healthcheck-YYYY-MM-DD.jsonl`.

## 2) Create Scheduled Task (schtasks)

Run PowerShell as your normal user (no admin required for a per-user task):

```powershell
$taskName = "Scheduler - Healthcheck (10m)"
$repo = "E:\scheduler"
$script = Join-Path $repo "utils\\Invoke-HealthCheck.ps1"
$url = "https://YOUR_HOST/api/health"

$tr = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" -Url `"$url`" -FailOnError -Quiet"

schtasks /Create /F /SC MINUTE /MO 10 /TN $taskName /TR $tr
```

## 3) Verify / Manage

```powershell
schtasks /Query /TN "Scheduler - Healthcheck (10m)" /V /FO LIST
schtasks /Run   /TN "Scheduler - Healthcheck (10m)"
schtasks /End   /TN "Scheduler - Healthcheck (10m)"
schtasks /Delete /F /TN "Scheduler - Healthcheck (10m)"
```

## Notes

- If you want to avoid hardcoding the URL in the task, set a user environment variable:
  - `HEALTH_URL=https://YOUR_HOST/api/health`
  - Then omit `-Url ...` in the task args.
- If the URL is HTTPS and you're on an older Windows image, TLS settings can break; the script forces TLS 1.2.
