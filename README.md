# beans

A money-management app built on the double-entry plain-text accounting format
[Beancount](https://beancount.github.io). FastAPI backend, React + Vite frontend,
Postgres for application state (budget targets, goals, investments, quote cache).
The ledger itself remains a `.beancount` file on disk.

## Quick start (docker-first)

Prerequisites: Docker 24+ and the Compose plugin.

```sh
# 1. clone, then:
cp .env.example .env                          # tweak passwords / paths
mkdir -p config ledger                        # see "Configuration" below
$EDITOR config/config.yaml                    # create users + secret_key
docker compose up --build
```

The frontend is on http://localhost:${FRONTEND_PORT:-80}. The backend speaks
only to Postgres and to the bind-mounted config / ledger directories — it
isn't exposed on the host.

### Configuration

Drop a `config.yaml` into the host directory you point `BEANS_CONFIG_DIR` at.
The path inside the container is `~/.config/beans/config.yaml`:

```yaml
secret_key: "<long random string used to sign JWT cookies>"

users:
  kevin:
    # bcrypt hash — generate with:
    #   python -c 'import bcrypt; print(bcrypt.hashpw(b"<pw>", bcrypt.gensalt()).decode())'
    password: "$2b$12$..."
    # Path *inside* the container. Mount the host file at this location via
    # BEANS_LEDGER_DIR (defaults to /data/ledger inside the container).
    ledger: /data/ledger/kevin.beancount
```

### Data

Postgres data lives in the named volume `beans-pg-data`. To reset it:

```sh
docker compose down -v        # drops the volume — destroys app state
```

The ledger file itself is never written to by the database; it's the
authoritative store for transactions and directives. Postgres only holds
the app-specific data (budget targets, goals, investment holdings, quote cache).

## Local development without Docker

Backend:

```sh
cd server
python -m venv venv && . venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgres://beans:beans@localhost:5432/beans
export BEANS_CONFIG=~/.config/beans/config.yaml
uvicorn main:app --reload
```

Frontend:

```sh
cd client
yarn install
yarn dev        # Vite proxies /api and /health to localhost:8000
```

## Deploying from GHCR

GitHub Actions builds and pushes `ghcr.io/<owner>/beans-back` and
`ghcr.io/<owner>/beans-front` on every push to `main` (and verifies the build
on every PR — without pushing). To run those images instead of building
locally, set `IMAGE_REPO=ghcr.io/<owner>/beans` in `.env` and:

```sh
docker compose pull && docker compose up -d
```

## Project layout

```
client/                 # React + Vite + TS
server/
  main.py               # FastAPI entrypoint + lifespan(init_db)
  api/                  # HTTP routers (one per resource)
  modules/
    config.py           # YAML config loader (lazy)
    auth.py             # JWT-cookie session helpers
    db.py               # Postgres connection + DDL
    ledger.py           # Beancount file read/write helpers
    quotes.py           # Yahoo Finance fetch
    reports.py          # Trial balance / balance sheet / income statement
docker-compose.yaml     # db + backend + frontend
.github/workflows/      # CI: build + push to GHCR, PR verification
```

## Roadmap

- [ ] Investment support
- [ ] Machine-learning projections and advice
