set shell := ["pwsh", "-NoProfile", "-Command"]

port := "4173"
url := "http://localhost:" + port + "/lol-stats-flow/"
pid_file := ".just-server.pid"
log_file := ".just-server.log"

# List recipes
default:
    @just --list

# Agent "done" gate: lint, token + doc lint, typecheck, unit tests, build (no e2e)
verify:
    npm run lint
    npm run lint:tokens
    npm run lint:docs
    npm run typecheck
    npm test
    npm run build

# verify + Playwright e2e
verify-full: verify
    npm run test:e2e

# Trigger release.yml (prepare job) to open a human-gated release PR. bump: auto|patch|minor|major
release bump="auto":
    @if ('{{ bump }}' -notin 'auto','patch','minor','major') { Write-Error 'bump must be auto, patch, minor, or major'; exit 1 }
    gh workflow run release.yml --ref main -f bump={{ bump }}
    @Start-Sleep -Seconds 3; gh run list --workflow release.yml --limit 1

# Build, serve in the background, and open the browser
start: _ensure-stopped build _serve _open

# Stop the running server, then start again
restart: stop start

# Stop the server, clean build output, then start fresh
rebuild: stop clean start

# Typecheck + production build
build:
    npm run build

# Remove build output and incremental TS build info
clean:
    @foreach ($d in 'dist', 'node_modules/.tmp') { if (Test-Path $d) { Remove-Item -Recurse -Force $d } }

# Stop the background server (no-op if not running)
stop:
    @if (Test-Path '{{ pid_file }}') { Stop-Process -Id (Get-Content '{{ pid_file }}') -Force -ErrorAction SilentlyContinue; Remove-Item '{{ pid_file }}' }; Get-NetTCPConnection -LocalPort {{ port }} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host 'Server stopped.'

# Tail the background server log
logs:
    @Get-Content '{{ log_file }}' -Wait

_ensure-stopped:
    @if (Get-NetTCPConnection -LocalPort {{ port }} -State Listen -ErrorAction SilentlyContinue) { Write-Error 'Port {{ port }} is already in use. Run `just restart` instead.'; exit 1 }

_serve:
    @$p = Start-Process node -ArgumentList 'node_modules/vite/bin/vite.js','preview','--port','{{ port }}','--strictPort' -WindowStyle Hidden -RedirectStandardOutput '{{ log_file }}' -RedirectStandardError '{{ log_file }}.err' -PassThru; Set-Content '{{ pid_file }}' $p.Id; Write-Host "Serving {{ url }} (pid $($p.Id)); logs: just logs"

_open:
    @Start-Sleep -Seconds 5; Start-Process '{{ url }}'
