- [2026-03-01] CLAUDE-Architect – Response: DreamHost proxy + backend listen config – Source files read: `backend/cmd/dryft-api/main.go:890` (server Addr) and `backend/internal/config/config.go:94,97` (Port and DatabaseURL). Findings: (1) **Listen address**: port is controlled by env var `PORT` (default `"8080"`). Bind address is hardcoded as `":" + cfg.Port` (line 890 main.go) which Go resolves to `0.0.0.0:PORT` — already binds all interfaces. No `BIND_ADDRESS` or `HOST` env var exists. DreamHost's "all hosts" requirement is satisfied by default; just set `PORT=8080` (or any high port). (2) **DATABASE_URL**: read at `config.go:97` via `getEnv("DATABASE_URL", "postgres://dryft:dryft@localhost:5432/dryft?sslmode=disable")`. The default localhost fallback is exactly what caused `dial tcp 127.0.0.1:5432: connection refused` — the env var was not loaded into the process. (3) **Critical: no dotenv loader** — the binary uses plain `os.Getenv()` with no godotenv or similar. `.env.prod` must be explicitly exported to the shell before starting. (4) **Production validation**: `config.go:143` enforces `ENCRYPTION_KEY` (exactly 32 bytes), `STRIPE_SECRET_KEY`, and `JWT_SECRET_KEY` (≥32 chars) when `ENVIRONMENT=production` — config.Load() will fail at startup if any are missing. **Step-by-step for HUMAN-Grant:** Step 1 — on VPS, `nano /home/thedirtyadmin/api.dryft.site/opt/dryft/.env.prod` and ensure these are set: `PORT=8080`, `DATABASE_URL=postgres://USERNAME:PASSWORD@YOUR-RDS-HOST:5432/dryft?sslmode=require`, `ENVIRONMENT=production` (plus ENCRYPTION_KEY, JWT_SECRET_KEY, STRIPE_SECRET_KEY already present). Step 2 — start foreground: `cd /home/thedirtyadmin/api.dryft.site/opt/dryft && export $(grep -v '^#' .env.prod | xargs) && ./dryft-api` — expect log line `server starting port=8080 environment=production`. Step 3 — in second SSH session: `curl -s http://localhost:8080/health` — expect `{"status":"healthy","database":"ok",...}`. If database is unreachable, RDS security group or DATABASE_URL host is wrong. Step 4 — once /health returns 200, set DreamHost proxy target to `http://127.0.0.1:8080`, then verify externally: `curl -s https://api.dryft.site/health`. Step 5 — daemonize: `nohup bash -c 'export $(grep -v "^#" .env.prod | xargs) && ./dryft-api' > dryft.log 2>&1 &`. Recommended follow-up: consider pm2 for auto-restart. Also confirm DreamHost proxy forwards `X-Forwarded-For` and `X-Forwarded-Proto` headers (required for rate limiter's `middleware.RealIP`) and that WebSocket upgrade works at `wss://api.dryft.site/v1/ws` (test after initial /health passes).

- [2026-03-01] HUMAN-Grant – Question for CLAUDE-Architect (DreamHost proxy + backend listen config)

  **Context:** Dryft backend is now cross-compiled and uploaded to the DreamHost VPS at `/home/thedirtyadmin/api.dryft.site/opt/dryft/dryft-api`, with `.env.prod` present and wired via our usual env loading. `api.dryft.site` has a valid HTTPS cert and a DreamHost panel proxy entry ready, but the app exits immediately with `failed to connect to database (dial tcp 127.0.0.1:5432: connection refused)`. DreamHost’s "Proxy Server" doc says the backend daemon must listen on a high port (8000–65535) bound to all hosts, and the panel will forward `api.dryft.site` to that port.

  **What we need from you (CLAUDE-Architect):**

  1. **Backend listen address/port configuration:**
     - Identify exactly where in the Go backend the HTTP server’s listen address and port are configured (e.g., `main.go`, `server.go`, `config.go`).
     - Tell us which environment variables (or flags) control the listen address and port (for example `PORT`, `HTTP_PORT`, `ADDR`, `BIND_ADDRESS`, etc.), and what their default values are if unset.
     - Confirm whether the server currently binds to `127.0.0.1` or `0.0.0.0` by default.

  2. **Recommended DreamHost-friendly listen settings:**
     - Given DreamHost’s proxy requirements, recommend a specific listen address and port for the VPS (for example `0.0.0.0:8002`).
     - Provide the exact env var values (and/or CLI flags) we should set in `.env.prod` on the VPS to make `dryft-api` listen on that address/port.

  3. **Database URL location and override:**
     - Point out exactly where `DATABASE_URL` (or equivalent) is read in the backend code.
     - Confirm the current default `DATABASE_URL` (which appears to be pointing at `127.0.0.1:5432`) and how to override it via `.env.prod`.
     - Recommend a safe production-style `DATABASE_URL` placeholder format for RDS (e.g. `postgres://USERNAME:PASSWORD@HOST:5432/DBNAME?sslmode=require`) that we can drop into `.env.prod` without exposing secrets in the repo.

  4. **Step-by-step for HUMAN-Grant (VPS side):**
     - Using your answers to (1)–(3), write out a short, precise checklist for HUMAN-Grant to:
       1) edit `.env.prod` on the VPS to set the correct listen address/port and `DATABASE_URL`,
       2) start `dryft-api` as a foreground process for the first test,
       3) verify `/health` locally on the VPS (curl against localhost:PORT), and
       4) enable DreamHost proxy so that `https://api.dryft.site/health` routes to that same process.

  Please answer with concrete file paths, env var names, and example values so that HUMAN-Grant can follow your instructions without guessing.
