# KFUPM GeoGuesser — Cloud-Native Technical Report

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [The 15 Factors](#2-the-15-factors)
3. [REST API Documentation](#3-rest-api-documentation)
4. [Source Code Repositories](#4-source-code-repositories)
5. [Appendix — AI Prompt Files](#5-appendix--ai-prompt-files)

---

## 1. System Architecture

### Overview

KFUPM GeoGuesser is a cloud-native web application where players are shown photographs taken around the KFUPM campus and must guess the location on a map. Photographers upload photos through a dedicated interface; administrators approve or reject submissions and manage user accounts.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                 │
│                                                                             │
│   React SPA  ──→  /api/game/*   ──→  nginx (port 80)                       │
│                   /api/upload/* ──→  nginx (port 80)                        │
│                   /api/*        ──→  nginx (port 80)                        │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │  HTTP
                      ┌───────────▼──────────────────────────────────────┐
                      │            EC2 t3.micro  (eu-north-1)             │
                      │                                                    │
                      │  ┌─────────────────────────────────────────────┐ │
                      │  │  Docker Compose                              │ │
                      │  │                                              │ │
                      │  │  ┌──────────────────┐  ┌─────────────────┐  │ │
                      │  │  │  frontend         │  │  api            │  │ │
                      │  │  │  nginx:1.27-alpine│  │  node:20-alpine │  │ │
                      │  │  │  port 80          │  │  port 5000      │  │ │
                      │  │  │                  │  │                 │  │ │
                      │  │  │ /api/game/*  ────┼──┼→ API Gateway    │  │ │
                      │  │  │ /api/upload/*────┼──┼→ API Gateway    │  │ │
                      │  │  │ /api/*      ─────┼──┼→ api:5000       │  │ │
                      │  │  │ /*          → SPA │  │                 │  │ │
                      │  │  └──────────────────┘  └────────┬────────┘  │ │
                      │  └──────────────────────────────────┼───────────┘ │
                      │                                      │             │
                      │   AWS SSM Agent (remote management)  │             │
                      └──────────────────────────────────────┼─────────────┘
                                                             │ mysql2
                   ┌─────────────────────────────────────────┼───────┐
                   │          AWS Managed Services            │       │
                   │                                          │       │
                   │  ┌──────────────────────────┐           │       │
                   │  │  Amazon RDS MySQL 8.0     │◄──────────┘       │
                   │  │  db.t3.micro              │                   │
                   │  │  tables: users, photos    │                   │
                   │  └──────────────────────────┘                   │
                   │                                                   │
                   │  ┌──────────────────────────┐                   │
                   │  │  Amazon S3               │                   │
                   │  │  kfupm-geoguesser bucket  │                   │
                   │  │  stores photo files       │                   │
                   │  └──────────┬───────────────┘                   │
                   │             │ presigned PUT                       │
                   │  ┌──────────▼───────────────┐                   │
                   │  │  API Gateway HTTP API     │                   │
                   │  │  (eu-north-1)             │                   │
                   │  │  GET  /game/random        │                   │
                   │  │  POST /upload/presign     │                   │
                   │  └──────┬──────────┬─────────┘                   │
                   │         │          │                              │
                   │  ┌──────▼───┐ ┌───▼──────┐                      │
                   │  │ Lambda   │ │ Lambda   │                      │
                   │  │ game     │ │ upload   │                      │
                   │  │ 256 MB   │ │ 256 MB   │                      │
                   │  │ node20.x │ │ node20.x │                      │
                   │  └──────────┘ └──────────┘                      │
                   │                                                   │
                   │  ┌──────────────────────────┐                   │
                   │  │  Amazon ECR              │                   │
                   │  │  kfupm-geo-api:latest     │                   │
                   │  │  kfupm-geo-frontend:latest│                   │
                   │  └──────────────────────────┘                   │
                   └───────────────────────────────────────────────────┘

                   ┌───────────────────────────────────────────────────┐
                   │             CI/CD Pipeline (GitHub Actions)        │
                   │                                                    │
                   │  push → main                                       │
                   │    1. Test  (npm ci + npm run build)               │
                   │    2. Build & Push                                 │
                   │       a. Build API image → ECR                     │
                   │       b. Build Frontend image → ECR                │
                   │       c. Terraform apply (infra + Lambda)          │
                   │    3. Deploy to EC2                                │
                   │       a. Wait for SSM agent                        │
                   │       b. docker compose pull + up --force-recreate │
                   └───────────────────────────────────────────────────┘
```

### Component Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 18, nginx | SPA served as static files; nginx reverse-proxies API calls |
| API Server | Express 5, Node 20 | Auth, photo management, admin operations |
| Game Lambda | Node 20, mysql2 | Serverless random photo selection from RDS |
| Upload Lambda | Node 20, AWS SDK v3 | Serverless presigned S3 URL generation |
| Database | Amazon RDS MySQL 8.0 | Persistent storage for users and photos |
| Object Storage | Amazon S3 | Photo file storage |
| Container Registry | Amazon ECR | Stores Docker images |
| Compute | EC2 t3.micro | Runs Docker Compose (frontend + API) |
| API Gateway | AWS HTTP API | Routes Lambda invocations |
| CI/CD | GitHub Actions | Automated test → build → deploy pipeline |
| IaC | Terraform 1.7 | Declarative AWS infrastructure |

---

## 2. The 15 Factors

### Factor 1 — One Codebase, One Application

> *One codebase tracked in version control, many deploys.*

The entire project lives in a single Git repository (`coderbasil/CloudNative-KFUPMGG`) organized into clearly separated applications:

```
/client          ← React frontend application
/server          ← Express API application
/infra/lambdas/game    ← Game microservice (Lambda)
/infra/lambdas/upload  ← Upload microservice (Lambda)
/infra           ← Terraform infrastructure-as-code
.github/workflows/deploy.yml  ← CI/CD pipeline
```

Each application has its own `package.json` with pinned dependencies and its own Dockerfile. A single `git push` to `main` triggers the full deployment pipeline for all components simultaneously. There is exactly one codebase and one source of truth.

---

### Factor 2 — API First

> *Design the API before implementing the application.*

Every interaction in the system occurs through a well-defined REST API:

- The **React frontend** communicates exclusively via HTTP to `/api/*` endpoints — it never accesses the database directly.
- The **Game Lambda** is exposed via an API Gateway HTTP API route (`GET /game/random`) and called through nginx.
- The **Upload Lambda** is exposed via `POST /upload/presign` — the browser receives a presigned URL and uploads directly to S3 without going through any server.
- The **Admin panel** uses JWT-authenticated REST endpoints (`/api/admins/*`) for all user management operations.

nginx acts as the single ingress point, routing requests to the correct backend based on path prefix, enabling each service to evolve independently.

---

### Factor 3 — Dependency Management

> *Explicitly declare and isolate dependencies.*

All dependencies are explicitly declared and version-locked:

| Component | Mechanism | Lock File |
|-----------|-----------|-----------|
| Frontend | `package.json` | `package-lock.json` |
| API Server | `package.json` | `package-lock.json` |
| Game Lambda | `package.json` | `package-lock.json` |
| Upload Lambda | `package.json` | `package-lock.json` |
| Infrastructure | `versions.tf` (AWS provider ~>5.0) | Terraform lock file |

The CI pipeline runs `npm ci` (not `npm install`) everywhere — `npm ci` installs exactly the versions in the lock file, making builds fully reproducible. Docker multi-stage builds install only production dependencies (`--omit=dev`) in the final image layer, keeping images minimal and preventing development tools from leaking into production.

---

### Factor 4 — Design, Build, Release, and Run

> *Strictly separate build and run stages.*

The GitHub Actions pipeline enforces strict stage separation:

**Design** → Git repository (Terraform IaC, Dockerfiles, source code)

**Build stage** (job: `build-push`):
- `npm ci && npm run build` compiles the React app to static files
- `docker build` creates immutable, tagged images for API and frontend
- Images are pushed to Amazon ECR with the `latest` tag
- Lambda code is zipped and deployed via Terraform

**Release stage** (job: `build-push` → Terraform apply):
- `terraform apply` provisions or updates infrastructure
- The docker-compose.yml on EC2 is updated with the current ECR image references and all environment variables baked in at this point

**Run stage** (job: `deploy`):
- SSM sends `docker compose pull && docker compose up -d --force-recreate` to the EC2 instance
- Running containers are replaced with the new release without downtime

Build artifacts (Docker images) are immutable — the same image that passed tests is the one deployed to production.

---

### Factor 5 — Configuration, Credentials, and Code

> *Store config in the environment, never in code.*

No credentials or environment-specific values exist in the source code. Configuration is injected at different levels:

| Secret/Config | Stored In | Injected Via |
|---------------|-----------|-------------|
| `db_password` | GitHub Actions Secret | Terraform → docker-compose.yml env var |
| `jwt_secret` | GitHub Actions Secret | Terraform → docker-compose.yml env var |
| `DB_HOST`, `DB_USER`, `DB_NAME` | Terraform variable defaults | docker-compose.yml env vars |
| `AWS_BUCKET`, `AWS_REGION` | Terraform variable defaults | docker-compose.yml env vars |
| `LAMBDA_API_HOST` | Terraform output (API Gateway URL) | docker-compose.yml env var → nginx envsubst |
| Lambda DB credentials | Terraform → Lambda env vars | AWS Lambda runtime |

The nginx configuration template (`nginx.conf.template`) uses `envsubst` at container startup to substitute `LAMBDA_API_HOST` at runtime, allowing the same Docker image to work in any environment.

---

### Factor 6 — Logs

> *Treat logs as event streams.*

All application components write logs to stdout/stderr and never manage log files themselves:

- **Express API**: `console.log` / `console.error` → Docker captures these from stdout and routes to the host journal.
- **nginx**: Access and error logs go to stdout/stderr (Docker's default nginx configuration).
- **Lambda functions**: `console.error` → AWS CloudWatch Logs (automatic Lambda integration).
- **user_data.sh**: `exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1` — logs both to the console and to `/var/log/user-data.log`, visible via SSM for debugging.

Docker on EC2 routes all container output through the Docker logging driver. Logs can be retrieved with `docker logs <container>` or forwarded to CloudWatch by changing the Docker daemon's logging driver — no application changes required.

---

### Factor 7 — Disposability

> *Maximize robustness with fast startup and graceful shutdown.*

Every component is designed to be started, stopped, and replaced at any time:

- **Docker containers**: `restart: unless-stopped` policy ensures automatic restart after crashes. `docker compose up -d --force-recreate` replaces running containers with zero manual intervention.
- **Lambda functions**: Inherently disposable — each invocation is stateless, and AWS manages the lifecycle entirely. Cold start time is under 500ms.
- **EC2 instance**: The entire instance is defined as code (Terraform). If it fails, `terraform apply` recreates it in minutes from the same `user_data.sh` bootstrap script, with no manual steps.
- **user_data.sh**: Idempotent design — checks (`if [ ! -f /swapfile ]`, `if ! grep -q ...`) prevent failures on re-runs.

---

### Factor 8 — Backing Services

> *Treat backing services as attached resources.*

All backing services are accessed via environment variables and can be swapped without code changes:

| Backing Service | Env Var | Attachment Point |
|----------------|---------|-----------------|
| MySQL (RDS) | `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | API server, Lambda functions |
| S3 (photo storage) | `AWS_BUCKET`, `AWS_REGION` | Upload Lambda, API server |
| API Gateway (Lambda endpoint) | `LAMBDA_API_HOST` | nginx (frontend container) |

The RDS instance (`db.t3.micro`, MySQL 8.0) is a fully managed backing service — the application code uses standard `mysql2` connection strings with no AWS-specific code. Replacing RDS with a self-managed MySQL instance requires only changing the `DB_HOST` environment variable. Similarly, changing the S3 bucket requires only `AWS_BUCKET`.

---

### Factor 9 — Environment Parity

> *Keep development, staging, and production as similar as possible.*

Docker ensures the same runtime environment from a developer's laptop to production:

- The same `Dockerfile` produces the same image in CI and in production.
- `npm ci` in CI installs exactly the same dependency versions as local development.
- The multi-stage Dockerfile (`node:20-alpine` base for both API and frontend build) means the OS, Node version, and package manager are identical everywhere.
- Infrastructure is defined in Terraform — there is no manual configuration drift possible, since all infra changes must go through `terraform apply`.
- Local development can run `docker compose up` with a local `.env` file and get the same container configuration as production.

---

### Factor 10 — Administrative Processes

> *Run admin/management tasks as one-off processes.*

Administrative tasks are first-class features of the application, not out-of-band scripts:

- **Database schema management**: `server.js` runs `CREATE TABLE IF NOT EXISTS` on startup, ensuring the schema is always current without separate migration tooling.
- **User management**: The `/api/admins` endpoints (Create, Read, Delete) are REST operations callable from the Admin Panel UI or directly via curl.
- **Photo moderation**: `PATCH /api/photos/:id/status` is a standard API call — administrators use the Admin Panel to approve or reject photos.
- **EC2 management**: AWS SSM Run Command executes one-off shell commands on the instance (e.g., `docker compose pull`) without requiring SSH access or stored key pairs.
- **Infrastructure changes**: `terraform apply` is a one-off administrative process run by CI/CD on every merge to main.

---

### Factor 11 — Port Binding

> *Export services via port binding.*

Every service declares its own port and is self-contained:

| Service | Port | Binding |
|---------|------|---------|
| nginx (frontend) | 80 | `ports: ["80:80"]` in docker-compose.yml |
| Express API | 5000 | `app.listen(5000)` in server.js; internal Docker network only |
| Lambda (game) | — | AWS manages — exposed via API Gateway HTTPS (443) |
| Lambda (upload) | — | AWS manages — exposed via API Gateway HTTPS (443) |

The Express API binds to port 5000 but is **not** exposed on the host — it is only reachable by nginx on the internal Docker bridge network (`proxy_pass http://api:5000`), which reduces the attack surface. Port 80 is the single public-facing port for all traffic.

---

### Factor 12 — Stateless Processes

> *Execute the app as one or more stateless processes.*

Neither the API server nor the Lambda functions hold any in-memory state between requests:

- **Express API**: No session storage, no in-process cache, no local file writes. All persistent state lives in RDS MySQL. Authentication state is carried in JWT tokens (client-side), not server-side sessions.
- **Lambda functions**: AWS Lambda execution environments are inherently ephemeral — any state written to memory or `/tmp` is lost between invocations. The `mysql2` connection pool uses `connectionLimit: 1` to account for Lambda's single-threaded execution model.
- **nginx**: Serves pre-built static files and proxies API requests — completely stateless.
- **S3**: Photo files are stored in S3 (external backing service), not on the EC2 instance disk.

Any number of container instances could run simultaneously without sharing state, making horizontal scaling straightforward.

---

### Factor 13 — Concurrency

> *Scale out via the process model.*

The system is designed for horizontal scale at every tier:

- **Frontend requests**: nginx handles thousands of concurrent connections and serves the React SPA from memory. Multiple EC2 instances behind a load balancer would require no application changes.
- **API requests**: The Express server handles concurrent requests through Node.js's event loop. Running additional API containers (or instances) requires only updating the nginx upstream block.
- **Game and photo queries**: AWS Lambda scales automatically — AWS provisions new execution environments in parallel to handle concurrent game requests. There is no explicit concurrency management in the Lambda code.
- **S3 uploads**: The presigned URL pattern offloads file transfer entirely to S3, which has essentially unlimited concurrency. The Lambda generates the URL and returns immediately; the browser uploads directly.
- **Database**: RDS MySQL handles connection pooling server-side. Connection limits are declared per-process (`connectionLimit: 1` in Lambdas, standard pool in the API).

---

### Factor 14 — Telemetry

> *Instrument your application for observability.*

The system has observability built in at multiple levels:

**Health checks** — Docker HEALTHCHECK directives probe both containers:
```dockerfile
# API: checks its own HTTP endpoint
HEALTHCHECK CMD wget -qO- http://localhost:5000/api/photos/random || exit 1

# Frontend: checks nginx is serving
HEALTHCHECK CMD wget -qO- http://localhost/ || exit 1
```

**Infrastructure monitoring** — EC2 instance status checks (2/2) are tracked by AWS. RDS has automated backups (7-day retention) and CloudWatch metrics enabled by default.

**Lambda telemetry** — All Lambda invocations are automatically logged to AWS CloudWatch Logs with duration, memory usage, and cold-start metrics.

**Deployment logging** — `user_data.sh` logs every command (`set -xe`) to `/var/log/user-data.log` and the system console. The GitHub Actions deploy job retrieves SSM command output (stdout/stderr) and prints it in the pipeline log.

**SSM agent** — The EC2 instance registers with AWS Systems Manager, enabling remote command execution, patch management, and session manager access — all without opening SSH.

---

### Factor 15 — Authentication and Authorization

> *Security is not an afterthought.*

The system implements layered authentication and authorization:

**Authentication**:
- Users authenticate via `POST /api/auth/login` with email and bcrypt-hashed password comparison.
- On success, the server issues a **JWT** (HS256, signed with `JWT_SECRET`, 24h expiry) containing `{ id, email, type }`.
- The token is stored client-side in `localStorage` and sent as `Authorization: Bearer <token>` on every protected request.
- Passwords are hashed with `bcrypt` (cost factor 10) — plaintext passwords are never stored.

**Authorization**:
- The `requireAdmin` middleware validates the JWT signature and checks `payload.type === "admin"` before allowing access to `/api/admins/*`.
- Role-based routing: after login, users are redirected to `/gamepage` (player), `/photographer` (photographer), or `/admin` (admin) based on their `type` field.
- The Admin panel performs a client-side guard on load — if `localStorage` does not contain a valid admin token, the user is immediately redirected to `/login`.

**Infrastructure security**:
- EC2 security group allows inbound only on ports 80 (HTTP) and 22 (EC2 Instance Connect). No SSH keys are stored.
- RDS is **not publicly accessible** (`publicly_accessible = false`) — only the EC2 and Lambda security groups can reach port 3306.
- GitHub Actions uses **OIDC federation** (no stored AWS keys) to assume the deployment role via `aws-actions/configure-aws-credentials`.
- Secrets (`db_password`, `jwt_secret`) are stored in GitHub Actions Secrets and injected into the environment at deploy time — they never appear in source code or Docker images.

---

## 3. REST API Documentation

### Base URLs

| Service | Base URL |
|---------|---------|
| EC2 Express API | `http://<EC2-PUBLIC-IP>/api` |
| Lambda via API Gateway | `https://<API-GATEWAY-ID>.execute-api.eu-north-1.amazonaws.com` |

nginx on the EC2 instance transparently forwards:
- `/api/game/*` → API Gateway → Game Lambda
- `/api/upload/*` → API Gateway → Upload Lambda
- `/api/*` → Express API (port 5000)

---

### Authentication Endpoints

#### `POST /api/auth/register`

Creates a new player account.

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "min8chars"
}
```

**Responses**

| Status | Body |
|--------|------|
| 201 | `{ "message": "User created successfully", "role": "player" }` |
| 400 | `{ "message": "Email already exists" }` |
| 400 | `{ "message": "Password must be at least 8 characters long" }` |

---

#### `POST /api/auth/login`

Authenticates a user and returns a JWT.

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "min8chars"
}
```

**Responses**

| Status | Body |
|--------|------|
| 200 | `{ "message": "Login successful", "role": "admin\|photographer\|player", "token": "<JWT>" }` |
| 400 | `{ "message": "Invalid email or password" }` |

---

### Photo Endpoints

#### `GET /api/photos`

Returns all photos (all statuses). Used by the Admin Panel.

**Response** `200`
```json
[
  {
    "id": 1,
    "url": "https://kfupm-geoguesser.s3.eu-north-1.amazonaws.com/photos/...",
    "coord_x": 26.307,
    "coord_y": 50.153,
    "diff": "Medium",
    "location_name": "Library Building",
    "photographer": "user@example.com",
    "status": "Approved",
    "created_at": "2025-01-01T00:00:00.000Z"
  }
]
```

---

#### `POST /api/photos`

Creates a photo record (called after a successful S3 upload).

**Request Body**
```json
{
  "url": "https://bucket.s3.region.amazonaws.com/photos/...",
  "coord": { "x": 26.307, "y": 50.153 }
}
```

**Responses**

| Status | Body |
|--------|------|
| 201 | `{ "id": 42, "url": "...", "coord_x": 26.307, "coord_y": 50.153, ... }` |
| 400 | `{ "error": "url and coord {x,y} required" }` |

---

#### `PATCH /api/photos/:id/status`

Updates the approval status of a photo.

**Path Parameters**: `id` — photo ID

**Request Body**
```json
{ "status": "Approved" }
```
Valid values: `"Approved"`, `"Rejected"`, `"Pending"`

**Responses**

| Status | Body |
|--------|------|
| 200 | `{ "message": "Status updated" }` |
| 400 | `{ "error": "Invalid status" }` |

---

#### `PATCH /api/photos/:id/coords`

Updates the map coordinates of a photo.

**Request Body**
```json
{ "x": 26.307, "y": 50.153 }
```

**Response** `200`: `{ "message": "Coordinates updated" }`

---

### Admin Endpoints

All admin endpoints require the header:
```
Authorization: Bearer <JWT-with-type=admin>
```

#### `GET /api/admins`

Returns all users (id, username, email, type — no passwords).

**Response** `200`
```json
[
  { "id": 1, "username": "admin", "email": "admin@kfupm.edu.sa", "type": "admin" }
]
```

---

#### `POST /api/admins`

Creates a new user of any type.

**Request Body**
```json
{
  "username": "john",
  "email": "john@kfupm.edu.sa",
  "password": "SecurePass1!",
  "type": "photographer"
}
```
Valid types: `"player"`, `"photographer"`, `"admin"`

**Responses**

| Status | Body |
|--------|------|
| 201 | `{ "id": 5, "username": "john", "email": "john@kfupm.edu.sa", "type": "photographer" }` |
| 400 | `{ "message": "Email already in use" }` |
| 401 | `{ "message": "Unauthorized" }` |
| 403 | `{ "message": "Forbidden" }` |

---

#### `DELETE /api/admins/:id`

Deletes a user account.

**Path Parameters**: `id` — user ID

**Responses**

| Status | Body |
|--------|------|
| 200 | `{ "message": "User deleted successfully" }` |
| 404 | `{ "message": "User not found" }` |

---

### Lambda Endpoints (via nginx `/api/game/*`, `/api/upload/*`)

#### `GET /api/game/random`

Returns a random approved photo, excluding already-seen IDs.

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `exclude` | string | Comma-separated list of photo IDs to skip |

**Example**: `GET /api/game/random?exclude=1,5,12`

**Response** `200`
```json
{
  "id": 7,
  "url": "https://kfupm-geoguesser.s3.eu-north-1.amazonaws.com/photos/abc.jpg",
  "coord": { "x": 26.307, "y": 50.153 },
  "total": 42
}
```

| Field | Description |
|-------|-------------|
| `id` | Photo ID (used in `exclude` parameter for subsequent rounds) |
| `url` | Public S3 URL of the photo |
| `coord` | Correct answer coordinates on the campus map |
| `total` | Total number of approved photos (used to detect end of game) |

**Responses**

| Status | Body |
|--------|------|
| 200 | Photo object (above) |
| 404 | `{ "error": "No photos found" }` |

---

#### `POST /api/upload/presign`

Creates a photo record in the database and returns a presigned S3 PUT URL. The browser then uploads the file directly to S3 using this URL.

**Request Body**
```json
{
  "filename": "library-entrance.jpg",
  "contentType": "image/jpeg",
  "x": 26.307,
  "y": 50.153,
  "difficulty": "Medium",
  "locationName": "Main Library",
  "photographer": "user@example.com"
}
```

**Required fields**: `filename`, `contentType`, `x`, `y`

**Response** `200`
```json
{
  "uploadUrl": "https://kfupm-geoguesser.s3.eu-north-1.amazonaws.com/photos/...?X-Amz-Signature=...",
  "photo": {
    "id": 15,
    "url": "https://kfupm-geoguesser.s3.eu-north-1.amazonaws.com/photos/...",
    "coord": { "x": 26.307, "y": 50.153 },
    "diff": "Medium",
    "photographer": "user@example.com",
    "status": "Pending"
  }
}
```

The `uploadUrl` expires in **300 seconds**. The browser must issue a `PUT` request to this URL with the file body and the `Content-Type` header matching the `contentType` field sent in the request. No authentication header is required for the S3 PUT — the presigned URL carries all authorization.

---

## 4. Source Code Repositories

| Repository | URL |
|------------|-----|
| Application & Infrastructure | https://github.com/coderbasil/CloudNative-KFUPMGG |

The repository contains:
- `/client` — React frontend
- `/server` — Express API
- `/infra` — Terraform infrastructure + Lambda source code
- `/.github/workflows` — CI/CD pipeline

---

## 5. Appendix — AI Prompt Files

The following prompts were used with **Claude Sonnet 4.6** (via Claude Code CLI) to assist with architecture design, implementation, debugging, and documentation.

---

### A.1 Initial Architecture Design Prompt

```
I want there to be 2 microservices, one is the photo upload function and one
is the gamepage function, i think we should do them on lambda.
No the game state should be on the clients cache and not maintained in a db.
```

Claude designed the Lambda architecture: a stateless game Lambda that queries
RDS for a random approved photo (client tracks seen IDs), and an upload Lambda
that generates presigned S3 URLs so photos bypass Lambda's 6MB payload limit.

---

### A.2 Infrastructure Wiring Prompt

```
add the JWT_SECRET — wire it through Terraform → EC2 docker-compose → Express
```

Claude added `variable "jwt_secret" { sensitive = true }` to Terraform,
threaded it through the EC2 module's `templatefile` call, injected it into
the docker-compose.yml environment block, and added `JWT_SECRET` to the
GitHub Actions `-var` flags in the workflow.

---

### A.3 Admin Panel Build Prompt

```
build that (admin panel frontend)
```

Claude built `client/src/pages/Admin.jsx` (Photo Requests + User Accounts tabs
with JWT-authenticated fetch calls), `Admin.css` (dark glassmorphism design),
`server/routes/admins.js` (CRUD with `requireAdmin` middleware),
`server/middleware/auth.js` (JWT verification), and wired everything into
`App.js` and `server.js`.

---

### A.4 Deployment Debugging Prompts

```
[screenshot of GitHub Actions npm ci EUSAGE error]
[screenshot of GitHub Actions Deploy to EC2 — InvalidInstanceId error]
[showed cloud-final FAILED error message]
why is the SSM no longer connecting even though everything is fine and the instance is up
```

Through iterative debugging, Claude identified and fixed:
1. Missing `package-lock.json` in Lambda directories → ran `npm install` locally and committed lock files
2. InvalidInstanceId → Terraform recreated EC2 on every user_data change; added SSM wait loop (40 × 15s)
3. `cloud-final FAILED` → hardened `user_data.sh` with docker daemon wait loop, retry logic for docker-compose download and ECR login, and YAML value quoting
4. SSM never connecting → identified OOM killer eliminating `amazon-ssm-agent` during `docker compose pull` on t3.micro (1GB RAM); fixed by adding 2GB swap file before Docker operations
5. EIP recreated on every deploy (changing public IP) → separated `aws_eip` and `aws_eip_association` resources so the IP is stable across EC2 replacements
```
