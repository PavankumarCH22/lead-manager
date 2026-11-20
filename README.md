# Lead Manager

A small full-stack app for a sales user to capture and track leads.
Built for the Meru Technosoft Full Stack Developer screening assignment.

**Stack:** React (Vite) · Node.js + Express · SQLite (better-sqlite3) · JWT auth

## Features

**Required**
- Add a lead: name, email, phone, company, source (dropdown), status (New / Contacted / Qualified / Lost)
- Leads table with colour-coded status badges
- Edit a lead and update its status
- Delete with a confirmation dialog
- Search (name, email, company) and filter by status
- Input validation on both frontend and backend, with field-level errors

**Bonus (all included)**
- Signup / login; each user sees only their own leads
- Server-side pagination and column sorting
- Dashboard counts per status (click a card to filter the table)
- Automated API tests (12 tests, `node:test` + supertest)
- Deployable as a single service (the Express server serves the built React app)

## Run locally

Requires Node.js 20+ (developed on 22).

```bash
# 1. install both packages
npm run install:all

# 2. configure the server
cp server/.env.example server/.env      # then set JWT_SECRET to a long random string

# 3. start API (http://localhost:4000) and client (http://localhost:5173) in two terminals
npm run dev:server
npm run dev:client
```

Open http://localhost:5173, create an account, and add some leads.
The Vite dev server proxies `/api` to the Express server, so no CORS setup is needed in development.

### Run tests

```bash
npm test
```

### Production-style run (single process)

```bash
npm run build                 # builds client/dist
NODE_ENV=production JWT_SECRET=<long-random-string> npm start
```

The server detects `client/dist` and serves it alongside the API on `PORT` (default 4000).

## Project structure

```
server/
  src/
    app.js            Express app factory (middleware + routes)
    index.js          Entry point: env config, DB, listen
    db.js             SQLite schema + indexes
    validation.js     Lead / signup / login validation (single source of truth on the server)
    middleware.js     Auth guard, HttpError, central error handler
    routes/auth.js    POST /signup, POST /login, GET /me
    routes/leads.js   CRUD + search/filter/sort/pagination + stats
  tests/api.test.js   API tests (in-memory DB per test)
client/
  src/
    api.js            fetch wrapper: auth header, error normalising, network-failure handling
    auth.jsx          Auth context (token + current user)
    validation.js     Client-side validation mirroring the server
    pages/            AuthPage, LeadsPage
    components/       LeadForm (add + edit), ConfirmDialog, Dashboard, Field, StatusBadge
```

## API

All `/api/leads` routes require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account → `{ token, user }` |
| POST | `/api/auth/login` | Log in → `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| GET | `/api/leads` | List. Query: `q`, `status`, `sort` (name, company, status, source, created_at), `order` (asc/desc), `page`, `limit` (max 100) |
| GET | `/api/leads/stats` | `{ total, byStatus }` |
| GET | `/api/leads/meta` | Allowed statuses and sources |
| GET | `/api/leads/:id` | One lead |
| POST | `/api/leads` | Create |
| PUT | `/api/leads/:id` | Update |
| DELETE | `/api/leads/:id` | Delete (204) |

Errors are JSON: `{ "error": "message", "details": { "field": "message" } }` with 400 (validation),
401 (auth), 404 (not found / not yours), 409 (duplicate email).

## Why these choices

- **Express + SQLite:** matches the preferred Node stack while keeping setup to zero external services.
  The reviewer can run it with no database install. The schema is plain SQL and ports to PostgreSQL easily.
- **Vite + React, plain CSS:** small and fast; no UI library needed for a form, a table and two dialogs.
- **JWT in a Bearer header:** simple and stateless for a single-page app.
- **Single-deployable:** Express serves the built client, so one service on Render/Railway is enough.

## Database design

- `users(id, name, email UNIQUE NOCASE, password_hash, created_at)`
- `leads(id, user_id → users ON DELETE CASCADE, name, email, phone, company, source, status CHECK(...), created_at, updated_at)`
- Indexes on `(user_id, status)` and `(user_id, created_at DESC)`, matching the filter and default-sort paths.
  Every lead query is scoped by `user_id`.

## Assumptions

- A lead's email is **not** unique: the same contact may legitimately appear more than once (e.g. different deals).
- All six lead fields are required, as the brief says "required fields" without naming exceptions.
- Source options are a fixed list defined on the server: Website, Referral, LinkedIn, Cold Call, Email Campaign, Event, Other.
- Phone validation is deliberately loose (7–20 digits with `+ - ( )` and spaces) to allow international formats.
- Search matches name, email and company; status is a separate exact filter. Both combine.
- Accessing another user's lead returns 404 rather than 403, so ids cannot be probed.

## Security notes

- Passwords hashed with bcrypt; login returns one generic error for unknown email / wrong password.
- All SQL uses bound parameters; the sort column comes from a whitelist; `LIKE` wildcards in search terms are escaped.
- `helmet` headers, 100 KB body limit, rate limiting on `/api/auth` in production.
- Server refuses to start in production without a proper `JWT_SECRET`. Secrets live in `.env` (git-ignored); see `.env.example`.

## Deploying (e.g. Render / Railway)

- Build command: `npm run deploy:build`
- Start command: `npm start`
- Env vars: `NODE_ENV=production`, `JWT_SECRET`, optionally `DATABASE_FILE`
- SQLite writes to disk, so attach a persistent disk/volume and point `DATABASE_FILE` at it (free tiers with ephemeral disks reset data on redeploy).

## Scoped out / what I would improve with more time

- **Frontend tests** (component tests with Testing Library, and a Playwright e2e for the main flow).
- **Move JWT to an httpOnly cookie** (with CSRF protection) instead of `localStorage`, and add refresh tokens / logout-everywhere.
- **PostgreSQL + a migration tool** for production use; SQLite is great for this scope but limits horizontal scaling.
- **Lead activity history** (status change timeline, notes) and CSV import/export.
- **Optimistic UI updates** and a data-fetching library (TanStack Query) for caching and retries.
- **Email verification and password reset.**
- **Request logging and OpenAPI docs** for the API.

## Note from the author

Proud of: the backend is strict about ownership and input (every query scoped to the user, whitelisted sorting,
escaped search, field-level errors that the form renders inline), and it is covered by tests including a cross-user isolation test.
Trickiest bit: making the table state (search, status filter, sort, page) play well together: debounced search,
resetting to page 1 on filter change, and stepping back a page when the last row on a page is deleted.
