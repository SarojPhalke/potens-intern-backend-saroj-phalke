# Tamper-Evident Append-Only Log Service

A secure, append-only audit logging service built with **Node.js**, **Express.js**, and **PostgreSQL**. Every audit event is cryptographically linked to the previous event using **SHA-256**, creating an immutable and tamper-evident hash chain. The service also supports **Merkle-style batch verification** to optimize integrity checks on large datasets.

---

# Features

## Core Features

* Append-only audit log
* SHA-256 hash chaining
* Individual log verification
* Full chain verification
* Filtered JSON export
* API Key authentication
* Rate limiting on log creation
* Structured logging using Pino
* PostgreSQL with SQL migrations
* Centralized error handling

## Stretch Goal Implemented

* Merkle-tree style batch verification for faster integrity checks
* CLI verification command (`npm run verify`) for running full chain verification without starting the HTTP server

---

# Tech Stack

| Technology         | Purpose               |
| ------------------ | --------------------- |
| Node.js            | Runtime               |
| Express.js         | REST API              |
| PostgreSQL         | Database              |
| pg                 | PostgreSQL Driver     |
| crypto             | SHA-256 Hashing       |
| Pino               | Structured Logging    |
| express-rate-limit | Rate Limiting         |
| dotenv             | Environment Variables |

---

# Project Architecture

```text
                        Client
                           │
                           ▼
                     Express Routes
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
 API Key Middleware   Rate Limiter     Logger Middleware
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                      Controllers
                           │
                           ▼
                        Services
          ┌───────────────┼─────────────────┐
          ▼               ▼                 ▼
     Hash Service   Verify Service   Export Service
          │               │
          ▼               ▼
                    Models (PostgreSQL)
                           │
                           ▼
                     PostgreSQL Database
```

The project follows a layered architecture:

* **Routes** receive HTTP requests.
* **Middleware** handles authentication, rate limiting, request logging, and errors.
* **Controllers** coordinate requests and responses.
* **Services** contain business logic.
* **Models** interact with PostgreSQL.

---

# Hash Chain Design

Every log entry stores:

* Actor
* Action
* Payload
* Timestamp
* Previous Hash
* Current Hash

Hash generation:

```text
SHA256(
    actor +
    action +
    payload +
    previous_hash

)
```

Example chain:

```text
Log 1

Previous Hash = NULL
Current Hash  = H1

        │

        ▼

Log 2

Previous Hash = H1
Current Hash  = H2

        │

        ▼

Log 3

Previous Hash = H2
Current Hash  = H3

        │

        ▼

Log 4

Previous Hash = H3
Current Hash  = H4
```

Because each hash depends on the previous log, changing any log breaks every subsequent link in the chain.

---

# Tamper Detection

Suppose someone changes the action in Log 3.

Original:

```text
Action = CREATE_USER
Hash = H3
```

Tampered:

```text
Action = DELETE_USER
```

Recomputing the SHA-256 hash produces a different value.

```text
Computed Hash ≠ Stored Hash
```

The verification immediately fails because the log has been modified after creation.

---

# Verification Algorithm

## Individual Verification

`GET /log/:id`

The endpoint:

1. Retrieves the requested log.
2. Recomputes its SHA-256 hash.
3. Compares the computed hash with the stored `current_hash`.

If they match:

```text
Hash Valid = TRUE
```

Otherwise:

```text
Hash Valid = FALSE
```

---

## Full Chain Verification

`GET /verify`

The service verifies every log in chronological order.

Algorithm:

```text
Fetch Logs

↓

For each log

↓

Recompute SHA-256

↓

Compare with stored hash

↓

Verify previous_hash matches previous current_hash

↓

Continue

↓

PASS
```

If any verification fails:

```text
STOP

↓

Return first broken entry
```

Example response:

```json
{
  "success": false,
  "status": "FAIL",
  "brokenEntryId": 42
}
```
# CLI Verification

The project includes a command-line interface (CLI) that allows administrators to verify the integrity of the audit log directly from the terminal without making an HTTP request.

Run:

```bash
npm run verify
---

# Merkle-Style Batch Verification

To improve verification performance for large datasets, the project implements **Merkle-style batching**.

Instead of verifying every log individually on every request, logs are grouped into fixed-size batches.

Example:

```text
Batch 1

Logs 1 - 100

↓

Batch Hash 1

──────────────────────────

Batch 2

Logs 101 - 200

↓

Batch Hash 2

──────────────────────────

Batch 3

Logs 201 - 300

↓

Batch Hash 3
```

Each batch hash is generated by combining the hashes of all logs in that batch.

The batch hashes are then combined to produce a Merkle Root.

```text
                  Merkle Root

                /            \

         BatchHash1      BatchHash2

          /      \         /      \

       H1...H100      H101...H200
```

---


## Optimized Verification Flow

Instead of scanning every log:

```text
1

↓

2

↓

3

↓

...

↓

100000
```

The verifier first checks batch hashes.

```text
Verify Batch Hashes

↓

All Valid?

↓

YES

↓

PASS
```

If a batch fails:

```text
Locate Failed Batch

↓

Verify only logs in that batch

↓

Return first broken entry
```

This significantly reduces verification time on large audit logs.

---

# API Endpoints

## Create Log

```http
POST /log
```

Request Body

```json
{
    "actor":"Admin",
    "action":"CREATE_USER",
    "payload":{
        "username":"john"
    }
}
```

Creates a new immutable audit log entry.

---

## Retrieve Log

```http
GET /log/:id
```

Returns a log entry along with its verification status.

---

## Verify Chain

```http
GET /verify
```

Scans the audit chain and reports whether it has been tampered with.

---

## Export Logs

```http
GET /export
```

Supports filtering using query parameters.

Examples:

```http
GET /export?actor=Admin
```

```http
GET /export?startDate=2026-07-01
```

```http
GET /export?actor=Admin&startDate=2026-07-01&endDate=2026-07-31
```

---

# Security

## API Key Authentication

All endpoints are protected using an API key.

Clients must include:

```text
x-api-key: YOUR_API_KEY
```

---

## Rate Limiting

The `POST /log` endpoint is protected using **express-rate-limit** to prevent abuse.

---

# Structured Logging

Application events are logged using **Pino**.

Logged events include:

* Server startup
* Database connection
* Incoming HTTP requests
* Audit log creation
* Verification requests
* Export requests
* Authentication failures
* Rate limit violations
* Unexpected application errors

Pino logs are completely independent of the audit logs stored in PostgreSQL.

---

# Error Handling

Centralized Express error middleware provides consistent responses.

Example:

```json
{
    "success":false,
    "message":"Log not found"
}
```

---

# Database Schema

## logs

Stores immutable audit entries.

Key columns:

* id
* actor
* action
* payload
* previous_hash
* current_hash
* created_at

## merkle_batches

Stores batch hashes used for optimized verification.

Key columns:

* id
* start_log_id
* end_log_id
* batch_hash
* created_at

---

# Setup Instructions

## 1. Clone the repository

```bash
git clone <repository-url>

cd tamper-evident-log-service
```

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Configure environment variables

Create a `.env` file.

```env
PORT=5000
NODE_ENV=development
LOG_LEVEL=debug
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=tamper_log_db
MERKLE_BATCH_SIZE=10
API_KEY=my-super-secret-api-key
```

---

## 4. Create PostgreSQL database

```sql
CREATE DATABASE tamper_log_db;
```

---

## 5. Run SQL migrations

Execute all SQL files inside the `migrations` directory.

---

## 6. Start the application

```bash
npm run dev
```

Server:

```text
http://localhost:5000
```

---

## Run with Docker Compose (stretch)

This starts both the API and PostgreSQL together, with migrations applied automatically on first run.

```bash
docker compose up --build
```

That single command will:
1. Build the Node.js API image
2. Start PostgreSQL and wait until it's healthy
3. Run the SQL files in `migrations/` automatically (only on a fresh database volume)
4. Start the API, connected to the database

The API will be available at `http://localhost:5000`.

### Environment variables

Docker Compose reads a `.env` file in the project root for variable substitution. Copy `.env.example` to `.env` and fill in real values (especially `API_KEY`) before running.

### Re-running migrations

Migrations only auto-run against an **empty** database volume — this is intentional, so they never silently re-run against existing data. If you add a new migration file later and need to apply it to an existing database:

```bash
docker compose exec postgres psql -U postgres -d tamper_log_db -f /docker-entrypoint-initdb.d/002_create_merkle_batches.sql
```

Or, to start completely fresh (⚠️ deletes all data):
```bash
docker compose down -v
docker compose up --build
```

### Stopping

```bash
docker compose down
```



## API Testing

All endpoints require an `x-api-key` header. Set your key in `.env` as `API_KEY` — the examples below use `ABCD1234` as a placeholder; replace it with your actual key.

Base URL (local or Docker Compose): `http://localhost:5000`

---

### POST /log

Creates a new tamper-evident log entry. The server computes `previous_hash` and `current_hash` automatically — you only supply `actor`, `action`, and `payload`.

```bash
curl -s -X POST "http://localhost:5000/log" \
  -H "x-api-key: ABCD1234" \
  -H "Content-Type: application/json" \
  -d '{
    "actor": "Admin",
    "action": "LOGIN",
    "payload": { "ip": "192.168.1.10", "device": "Chrome/MacOS" }
  }'
```

**Response `201 Created`:**
```json
{
  "data": {
    "id": "1",
    "actor": "Admin",
    "action": "LOGIN",
    "payload": { "ip": "192.168.1.10", "device": "Chrome/MacOS" },
    "previous_hash": null,
    "current_hash": "a1b2c3...",
    "created_at": "2026-07-09T10:15:00.000Z"
  },
  "batch": null
}
```

`batch` is populated (instead of `null`) whenever this insert completes a batch of 10 logs (see [Merkle Batching](#merkle-batching) below).

---

### GET /log/:id

Fetches a single log entry and verifies its hash against a fresh recomputation.

```bash
curl -s -X GET "http://localhost:5000/log/1" \
  -H "x-api-key: ABCD1234"
```

**Response `200 OK`:**
```json
{
  "data": { "id": "1", "actor": "Admin", "action": "LOGIN", "...": "..." },
  "verification": {
    "is_valid": true,
    "expected_hash": "a1b2c3...",
    "stored_hash": "a1b2c3..."
  }
}
```

`404` if the id doesn't exist.

---

### GET /verify

Scans the **entire chain**, checking every entry's hash integrity and its link to the previous entry. Stops at the first broken entry.

```bash
curl -s -X GET "http://localhost:5000/verify" \
  -H "x-api-key: ABCD1234"
```

**Response — chain intact:**
```json
{ "status": "PASS", "entriesVerified": 30 }
```

**Response — tampering detected:**
```json
{
  "status": "FAIL",
  "entriesVerified": 14,
  "brokenEntryId": 15,
  "reason": "hash_mismatch"
}
```
(`reason` is either `hash_mismatch` — an entry's own data was altered — or `chain_link_mismatch` — an entry's `previous_hash` doesn't match the prior entry, e.g. from a deleted/reordered row.)

You can also run this check from the command line, without going through the API:
```bash
npm run verify
```

---

### GET /export

Returns a filtered JSON export by actor and/or date range. All filters are optional and combinable.

```bash
# Export everything
curl -s -X GET "http://localhost:5000/export" \
  -H "x-api-key: ABCD1234"

# Filter by actor
curl -s -X GET "http://localhost:5000/export?actor=Admin" \
  -H "x-api-key: ABCD1234"

# Filter by date range
curl -s -X GET "http://localhost:5000/export?startDate=2026-07-01&endDate=2026-07-31" \
  -H "x-api-key: ABCD1234"

# Combine filters
curl -s -X GET "http://localhost:5000/export?actor=Admin&startDate=2026-07-01&endDate=2026-07-31" \
  -H "x-api-key: ABCD1234"
```

**Response `200 OK`:**
```json
{
  "success": true,
  "count": 2,
  "filters": { "actor": "Admin", "startDate": "2026-07-01", "endDate": "2026-07-31" },
  "data": [ ... ]
}
```

---
  # Docker Compose
  docker compose logs -f app
```

# Design Decisions

## Why SHA-256?

SHA-256 is a cryptographic hash function that is deterministic, collision-resistant, and widely used for integrity verification. Any modification to a log entry produces a completely different hash.

---

## Why an Append-Only Design?

Audit logs should never be modified or deleted. This guarantees historical integrity and ensures every action remains traceable.

---

## Why Layered Architecture?

Separating routes, controllers, services, models, and middleware improves maintainability, readability, and testability.

---

## Why Pino?

Pino provides high-performance structured logging suitable for production applications while keeping business audit logs separate from application logs.

---

## Why Merkle-Style Batching?

Sequential verification requires scanning every log.

Merkle-style batching reduces verification work by checking batch hashes first and only inspecting individual logs when a batch fails, improving scalability for large datasets.

---

# Future Improvements

* Docker Compose deployment


