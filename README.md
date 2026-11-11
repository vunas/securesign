# SecureSign

SecureSign is a multi-tenant digital credential issuance and verification system. It consists of a FastAPI backend, a Next.js web application, and PostgreSQL.

## Architecture

- `core/`: asynchronous FastAPI application, SQLAlchemy persistence, tenant/RBAC services, private PKI, signing, verification, API keys, and audit logs.
- `web/`: Next.js App Router application for registration, tenant operations, signing, tracking, verification, and administration.
- `web-lms-demo/`: standalone Next.js external client that simulates a university LMS calling the batch-signing API.
- `docker-compose.yml`: PostgreSQL, API, and web services.

PDF content is processed for the duration of a request and is not stored as a credential file. The database stores credential metadata and hashes.

## Implemented workflows

- Organization registration, platform-admin approval, and active-tenant access control.
- Tenant roles, monthly signing quota, server-generated RSA/ECDSA keys, and X.509 signing certificates.
- PAdES PDF signing with an RFC 3161 TSA timestamp and a compact QR code linking
  to public verification.
- In-memory issuance and batch signing; signed files are returned to the caller.
- Public credential lookup, uploaded-PDF signature verification, and credential/key revocation.
- Tenant API-key creation/revocation, one-time secret display, batch API authentication, and per-minute request limits.
- Tenant audit and verification history, filtering, and audit CSV export.

## Requirements

- Python 3.12 or newer
- Node.js 22 or newer
- pnpm 12
- PostgreSQL 16

## Local development

Install workspace dependencies:

```powershell
pnpm install
```

For the easiest local demo, the backend has development-only defaults for `SECRET_KEY` and `ENCRYPTION_KEY`. Copy `core/.env.example` to `core/.env`; set `DATABASE_URL` to a reachable PostgreSQL instance:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
python -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
```

For production, set `APP_ENV=production` and use the generated values below instead of the demo defaults. Keep them outside source control. Changing `ENCRYPTION_KEY` makes previously encrypted private keys unreadable.

For a Compose-managed database, the default demo keys and database password work without an `.env` file. To override them, create a root `.env`:

```powershell
Copy-Item core\.env.example core\.env
Copy-Item core\.env.example .env
```

The Compose API connects to the `db` service automatically. These defaults are for local coursework/demo use only.

Start PostgreSQL, initialize the schema and seed development data, then start both applications:

```powershell
docker compose up -d db
pnpm seed:core
pnpm dev
```

The web application is available at `http://localhost:3000`; the API and OpenAPI documentation are at `http://localhost:8000` and `http://localhost:8000/docs`.

The seed command creates demo accounts and prints their usernames/passwords to the terminal:

| Role | Username | Password |
|---|---|---|
| Platform Super Admin | `admin` | `123456` |
| Tenant Admin | `giamdoc` | `123456` |
| Tenant Operator | `nhanvien` | `123456` |
| Tenant Operator | `demo` | `123456` |

These credentials and seed data are for local coursework/demo use only and must never be used in production.

## Docker

For a local demo, Compose starts with built-in development credentials. For production, set `APP_ENV=production`, `SECRET_KEY`, `ENCRYPTION_KEY`, and a strong `POSTGRES_PASSWORD` in the root Compose `.env`. Configure `TSA_URL` and `PUBLIC_APP_URL` for deployment. Then run:

```powershell
docker compose up --build
```

For HTTPS deployments, set `COOKIE_SECURE=true` and use an HTTPS `PUBLIC_APP_URL`.

## Useful commands

```powershell
pnpm dev                 # Start API and web in development mode
pnpm dev:core            # Start only FastAPI
pnpm dev:web             # Start only Next.js
pnpm dev:lms             # Start the external LMS demo on port 3001
pnpm dev:all             # Start API, tenant web, and LMS demo
pnpm lint:core           # Ruff checks
pnpm test:core           # Backend tests
pnpm lint:web            # ESLint
pnpm build:web           # Next.js production build
pnpm lint:lms            # LMS demo ESLint
pnpm build:lms           # LMS demo production build
pnpm seed:core           # Create demo schema/data without deleting existing data
pnpm seed:core:reset     # Destructively reset and recreate demo data
```

The external LMS demo is available at `http://localhost:3001` when started with
`pnpm dev:lms` or `pnpm dev:all`. It accepts a tenant `X-API-Key`, signing key
ID, PDF files, and per-document metadata, then downloads the ZIP returned by
`POST /api/batch/sign`. See [docs/lms-demo.md](docs/lms-demo.md) for the
integration flow and Docker usage.

## API entry points

- `POST /api/tenants/register`: register an organization for approval.
- `GET /api/admin/tenants` and `POST /api/admin/tenants/{id}/review`: platform-admin tenant review.
- `POST /api/credentials/issue`: issue and download a signed PDF.
- `POST /api/credentials/{id}/revoke`: revoke an issued credential.
- `GET /api/verify/credentials/{tracking_id}`: public credential status lookup.
- `POST /api/verify/pdf`: validate an uploaded signed PDF.
- `POST /api/batch/sign`: sign a batch with an `X-API-Key` header.
- `GET /api/logs/audit/export`: export tenant audit records as CSV.

Interactive API documentation is available at `/docs`.

## Tests

The backend tests use `DATABASE_URL_TEST` when set; otherwise they use the PostgreSQL test URL configured in `core/tests/conftest.py`. Run them with `pnpm test:core`. Frontend checks use `pnpm lint:web` and `pnpm build:web`.
