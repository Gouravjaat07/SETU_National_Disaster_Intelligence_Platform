# SETU — verified technical documentation

## 1. Project overview

SETU is a disaster-response web application. Its implemented flows cover a public advisory/analytics UI and authenticated portals for citizens, rescue teams, shelter administrators, NGOs, and authorities. The current code combines (a) legacy/demo analytical endpoints backed by `backend/mock_data.py` with (b) a MongoDB-backed operational subsystem in `backend/setu/routers/`.

This document is based on source code and active configuration, not README claims or dependency declarations. “Demo” below means the code supplies seeded/static data; it is not an external live government feed.

## 2. Verified stack

| Technology | Category | Evidence and role |
|---|---|---|
| JavaScript/JSX, HTML, CSS | frontend languages | `frontend/src/**`, `public/index.html`; React UI and Tailwind CSS styles. |
| Python | backend language | `backend/server.py`, `backend/setu/**`; HTTP service, domain logic, DB access. |
| React 19 / ReactDOM 19 | UI runtime | `src/index.js` creates the root; pages/components render the UI. |
| React Router DOM 7 | client routing | `src/App.js`, `components/auth/ProtectedRoute.jsx`, `layout/AppShell.jsx`. |
| Axios | HTTP client | `src/lib/api.js` and `src/lib/setuApi.js`; 60-second API clients. |
| TanStack React Query | query context | `src/index.js` creates/provides `QueryClient`; pages currently use Axios/effects rather than React Query hooks. |
| Tailwind CSS 3, PostCSS, Autoprefixer | styling build | Tailwind directives in `src/index.css`, config in `tailwind.config.js`, PostCSS config. |
| Radix UI primitives, CVA, clsx, tailwind-merge | UI primitives/utilities | Imported in `src/components/ui/**`; `Button`, `Slider`, `Progress` are imported by active pages. `src/lib/utils.js` builds class names. |
| Lucide React, Sonner | icons/toasts | Imported throughout active pages; root renders `Toaster` in `App.js`. |
| Leaflet / React Leaflet | interactive map | `components/map/FloodMap.jsx`, used by dashboard, live-map, simulation and rescue pages. It requests the OpenStreetMap tile URL configured in that component. |
| Recharts | charts | `pages/Economic.jsx` renders the economic-loss chart. |
| CRACO + Create React App/react-scripts + webpack | frontend build/dev | `package.json` scripts and `craco.config.js`; CRACO supplies the `@` alias and dev-server compatibility/configuration. |
| FastAPI 0.110.1 + Uvicorn 0.25.0 | ASGI API/server | `backend/server.py`, Render start command. |
| Pydantic v2 | request/domain schemas | request classes in `server.py`/routers and domain records in `setu/models.py`. |
| Motor 3.3.1 + PyMongo 4.6.3 | MongoDB async driver | `setu/db.py`, router queries, and `server.py` client. |
| MongoDB | operational database | `MONGO_URL`/`DB_NAME`; collections declared in `setu/db.py`. |
| PyJWT + bcrypt | auth/security | `setu/auth.py`: HS256 signed JWTs and password hash/verification. |
| python-dotenv | environment loading | `server.py` loads `backend/.env`; CRACO calls `dotenv` for frontend build config. |
| Mistral Python SDK | AI provider client | `backend/ai_service.py`; text, vision, and stream methods. |
| Render | backend deployment configuration | root `render.yaml`; installs backend requirements and starts Uvicorn. |
| Vercel | frontend hosting configuration | `frontend/vercel.json` has SPA rewrite only. |
| pytest / pytest-xdist | tests | Python test files and `backend/pytest.ini`; no frontend test implementation was found. |

Versions above are stated only where pinned in `requirements.txt` or `package.json`; package declaration alone is not evidence that a package is runtime-used.

## 3. Startup, deployment, and configuration

### Backend

`uvicorn server:app --host 0.0.0.0 --port $PORT` imports `backend/server.py`. It loads `backend/.env`, creates an `AsyncIOMotorClient`, mounts the legacy `/api` router and every `setu` router, configures CORS, then runs `setu.seed.seed(reset=False)` at startup. The seed is idempotent and creates demo users, teams, shelters, events, and relief requests, plus indexes. Seed failure is logged but does not stop startup. Shutdown closes the `server.py` Mongo client.

Render is the only configured backend host: `render.yaml` uses `backend/`, `pip install -r requirements.txt`, and the Uvicorn command above. Vercel has only a client-side rewrite configuration; it does not configure a build command or backend connection.

### Frontend

`yarn start` runs `craco start`; `yarn build` runs `craco build`; `yarn test` runs `craco test`. `src/index.js` renders `App` under `React.StrictMode` and a QueryClient provider. `App.js` supplies auth context, BrowserRouter, app shell, pages, protected routes, and Sonner toasts. Both Axios clients build their base URL as `${REACT_APP_BACKEND_URL}/api`.

### Environment variables (names only)

| Variable | Purpose | Source evidence |
|---|---|---|
| `MONGO_URL` | Mongo connection string | `server.py`, `setu/db.py`, `render.yaml` |
| `DB_NAME` | Mongo database name | `server.py`, `setu/db.py`, `render.yaml` |
| `JWT_SECRET` | HS256 signing key; code defaults to an insecure dev fallback if absent | `setu/auth.py`, `render.yaml` |
| `MISTRAL_API_KEY` | SDK key | `ai_service.py`, `render.yaml` |
| `MISTRAL_MODEL` | text/chat model override | `ai_service.py`, `render.yaml` |
| `MISTRAL_VISION_MODEL` | vision model override | `ai_service.py`, `render.yaml` |
| `CORS_ORIGINS` | comma-delimited allowed origins | `server.py`, `render.yaml` |
| `REACT_APP_BACKEND_URL` | frontend API host | `frontend/.env.example`, `src/lib/api.js`, `src/lib/setuApi.js` |
| `ENABLE_HEALTH_CHECK` | optional CRACO dev health plugin | `craco.config.js` |
| `NODE_ENV` | CRACO dev/production branch | `craco.config.js` |

## 4. System architecture

```text
Browser
  │ React 19 + Router + Tailwind UI (Axios; browser localStorage/geolocation)
  ├─────────────────────── HTTPS /api ───────────────────────┐
  │                                                            ▼
  │                                            FastAPI / Uvicorn (`server.py`)
  │                                              ├─ legacy/demo API router
  │                                              └─ SETU routers + JWT/RBAC
  │                                                        │        │
  │                                                        │        └─ Mistral SDK
  │                                                        │           text/chat/vision API
  │                                                        ▼
  │                                         MongoDB via Motor/PyMongo
  │                                         users, events, SOS, teams, shelters,
  │                                         relief, audit, notifications, etc.
  └─ Leaflet directly requests OSM map tiles (client side)

Configured hosting: Vercel (SPA rewrite) and Render (Python service). Mongo hosting/provider is not configured in the repository.
```

## 5. Frontend architecture

`App.js` is the route inventory. Public pages are `/`, `/login`, `/preparedness`, `/chatbot`, and `/shelters`; legacy analytical pages are role-protected (dashboard, map, prediction, resources, damage, simulation, incidents, volunteers, social, medical, economic, drones). Operational pages include citizen SOS/shelter finder, rescue leader/member/search, shelter admin, NGO, notifications, and authority admin/ingestion/conflicts/situation reporting.

`AuthContext.jsx` keeps a JWT in `localStorage` key `setu.token`, restores the user with `GET /auth/me`, sends `Bearer` through `setuApi`’s request interceptor, and clears state on a 401 response. `ProtectedRoute.jsx` redirects missing users to login and enforces UI role lists; server RBAC remains the authoritative enforcement. `offlineQueue.js` stores offline SOS payloads and last-known location in localStorage, obtains browser geolocation, and sends queued records to `/sos/sync` upon user-triggered sync.

`api.js` addresses the legacy endpoints; `setuApi.js` addresses the operational endpoints. Most pages use `useEffect` plus local React state; no application `useQuery` call was found. `FloodMap.jsx` displays supplied markers/lines with Leaflet. `GovUI.jsx` and `SetuBits.jsx` provide shared panels, badges, advisories and safety/staleness display.

## 6. Authentication and authorization

Citizens request a mobile OTP through `POST /api/auth/otp/request`, then submit it to `/otp/verify`. `generate_otp` writes a ten-minute code to `otp_codes`; this is explicitly demo behavior because the response returns the OTP and no SMS vendor exists. Staff log in through `/api/auth/login` using email/password; seeded staff passwords are bcrypt hashes created at startup. Successful verification returns a 72-hour HS256 JWT containing `sub` (`userId`), `role`, and `exp`.

`current_user` validates the bearer token and fetches the user from Mongo. `require_roles` protects handlers; `SUPER_ADMIN` is accepted by every such guard. Roles are `USER`, `RESCUE_LEADER`, `RESCUE_MEMBER`, `SHELTER_ADMIN`, `NGO_ADMIN`, `AUTHORITY`, and `SUPER_ADMIN`. Logout is client-only: it deletes the local token; the backend implements neither a session store nor token revocation.

## 7. Database architecture

`setu/db.py` exposes Mongo collections: `users`, `otp_codes`, `disaster_events`, `sos_records`, `teams`, `shelters`, `resource_requests`, `audit_log`, `search_operations`, `field_incidents`, `road_incidents`, `notifications`, `missing_register`, `arrival_logs`, `ngo_inventory`, `field_reports`, `conflicts`, `ingestion_state`, and `situation_reports`. The first nine are indexed by `ensure_indexes`: unique IDs for user/event/SOS/team/shelter/request; sparse mobile/email; SOS `(userId,status)` and `eventId`; and audit `(objectType,objectId,timestamp)`.

The Pydantic records in `setu/models.py` define the core shapes: `User` (role, identity/contact/profile/team/shelter/NGO references), `DisasterEvent` (source, status, tier, GeoJSON affected area/zones and version history), `SOSRecord` (owner/event/team IDs, immutable origin, last-known location, people counts, priority, lifecycle/history and completion report), `Team`, `Shelter`, `ResourceRequest`, `AuditEntry`, `SearchOperation`, and `FieldIncident`. `Location` is embedded (latitude, longitude, accuracy, timestamp, source, landmark). `shelter_view()` derives available/overflow and staleness at read time.

Routes use Motor CRUD (`find`, `find_one`, `insert_one`, `update_one`, `delete_one`, `count_documents`) rather than an ORM. Relationships are stored as IDs, not database-enforced foreign keys. The legacy `server.py` endpoints instead read lists/dictionaries from `mock_data.py`; only its simple SOS, volunteer, and family records write their named legacy collections (`sos_reports`, `volunteers`, `family_registry`).

## 8. External/API integrations

| API | Provider/type | Code use and authentication |
|---|---|---|
| Mistral chat/vision | Mistral AI SDK | `backend/ai_service.py` instantiates `Mistral(MISTRAL_API_KEY)`. `chat.stream_async` streams chatbot deltas, `chat.complete_async` produces advisory text, and a vision completion sends an image data URL. Model env vars select the text/vision models. SDK base URL/endpoints are not hardcoded, so this repository does not independently verify their literal paths. Failures usually trigger route-specific fallback or HTTP 500. |
| OpenStreetMap tiles | OpenStreetMap tile service, browser tile requests | `FloodMap.jsx`’s Leaflet `TileLayer` loads map imagery. No API key is supplied; the exact tile URL is defined there. |

There is no code call to NDEM, IMD, NDMA, PIB, weather, payments, SMS, email, cloud storage, or social-media APIs. References to these bodies in prompts/seed labels are not integrations.

Mistral request flow: a page posts input to FastAPI; an endpoint builds a disaster-oriented prompt; `ai_service` calls the SDK with a system/user message (and image data URL for vision); the route returns the text under `raw`, `suggestion`, `explanation`, or SSE `data` frames. `prediction/explain`, resource optimization, rescue advisory/cluster naming, and warning generation use fallback text on Mistral errors. Damage, water-depth, image classification, fake-news and non-stream chat return 500 on error except the streaming route, which sends an SSE error object.

## 9. Internal API inventory

All paths below are prefixed `/api`. Input bodies are Pydantic models in the listed router; query/path parameters are visible in the handler signature. “Auth” records the actual dependency level. Responses are JSON unless noted; validation failures are FastAPI 422, absent resources generally 404, missing/invalid token 401, insufficient role 403, and illegal lifecycle transitions 409 where implemented.

### Legacy/demo endpoints — `backend/server.py`

| Method/path | Handler and purpose | Storage/integration |
|---|---|---|
| GET `/` | `root`: platform status | none |
| GET `/overview/stats`, `/alerts/ticker`, `/regions`, `/monitoring/map-data` | `overview`, `ticker`, `regions`, `map_data` | static mock data |
| GET `/prediction/{region_id}`, `/predictions/all` | `prediction`, `predictions_all` | mock predictions; region missing → 404 |
| POST `/prediction/explain`, `/warning/generate` | `explain_prediction`, `warning_generate` | Mistral text with fallback |
| GET `/resources`; POST `/resources/optimize` | `resources`, `optimize_resources` | static data; optimize uses Mistral/fallback |
| POST `/shelter/recommend` | `recommend_shelter` | ranks static shelters by haversine/capacity/medical need |
| POST `/damage/estimate`, `/water-depth/estimate`, `/image/classify` | corresponding handlers | Mistral vision; `{image_base64, context?}`; 500 on AI error |
| POST `/fakenews/check` | `fakenews_check` | Mistral text; `{text, source?}`; 500 on error |
| POST `/chat/stream` | `chat_stream` | Mistral SSE `text/event-stream`; `{session_id?,message,lang?}` |
| POST `/chat/message` | `chat_message` | Mistral nonstream fallback |
| GET/POST `/incidents`; POST/GET `/incidents/sos` | `get_incidents`, `create_sos`, `list_sos` | incidents static; SOS writes/reads `sos_reports` |
| GET/POST `/volunteers` | `get_volunteers`, `register_volunteer` | static + Mongo `volunteers` |
| GET `/social/monitor`, `/weather`, `/medical/outbreak`, `/economic-loss`, `/preparedness`, `/emergency-contacts`, `/drones` | handlers with matching names | static mock data |
| POST `/simulation/flood`, `/rescue/route` | `simulate_flood`, `rescue_route` | deterministic calculations from request/body and mock data |
| GET/POST `/family-registry` | `family_registry`, `family_add` | static + Mongo `family_registry` |

### Authentication/events/governance

| Method/path | Handler / access | Purpose |
|---|---|---|
| POST `/auth/otp/request`, `/auth/otp/verify`, `/auth/login` | `otp_request`, `otp_verify`, `login`; public | request mock OTP, exchange OTP, or staff email/password for `{token,user}` |
| GET `/auth/me`; PATCH `/auth/profile`; POST `/auth/location` | authenticated | current safe user, profile edit, embedded last-known location |
| POST `/auth/staff`; GET `/auth/roles` | authority/super-admin; public | provision staff; list allowed role values |
| GET `/events`; GET `/events/{event_id}` | public | list/filter events or return one, with staleness view |
| POST `/events/{event_id}/transition` | authority/super-admin | state-machine transition plus audit |
| POST `/events/check-location` | optional auth | classify a supplied location against event polygons |
| GET `/events/alerts/for-me`; GET `/state-machines` | authenticated; public | alerts by user location; allowed lifecycle definitions |
| GET `/governance/advisory-registry`, `/governance/design-rules` | public | declared AI/advisory and design constraints |
| GET `/governance/compliance-report` | authority/super-admin | computed compliance view |

### SOS and rescue

| Method/path | Handler / access | Purpose |
|---|---|---|
| POST `/sos`; POST `/sos/sync`; GET `/sos/mine` | authenticated citizen; authenticated; authenticated | create SOS, replay offline batch, list caller’s records |
| GET `/sos/queue`; GET `/sos/assigned-to-me`; GET `/sos/{sos_id}`; GET `/sos/{sos_id}/timeline` | leader/authority; rescue role; authenticated with scope checks | operational queue, assignment, record, audit timeline |
| POST `/sos/{id}/cancel`; PATCH `/sos/{id}/location` | authenticated scope; authenticated scope | cancel or update last known location |
| POST `/sos/{id}/assign`; POST `/sos/timeout-scan` | leader/authority; leader/authority | assign team; advance timed-out cases |
| POST `/sos/{id}/accept`, `/reject`, `/status`, `/complete` | assigned rescue scope | lifecycle actions, completion report / potential search handling |
| GET `/rescue/dashboard`, `/rescue/teams`, `/rescue/recommendations/{sos_id}`, `/rescue/clusters`, `/rescue/ai-summary`, `/rescue/blocked-roads` | role-protected as declared in `rescue_routes.py` | work queue metrics, teams, matching, clusters/advisory, AI summary, road reports |
| POST `/rescue/teams`; POST `/rescue/teams/{id}/location`, `/status`; POST `/rescue/blocked-road` | rescue leader/authority or scoped rescue role | create/update teams and record blocked road |

### Search, shelters, relief, integrity, ingestion, authority, offline and admin

| Router | Every implemented endpoint (method shown) |
|---|---|
| Search | POST/GET `/search/operations`; GET `/search/operations/{id}`; POST `/search/operations/{id}/cells/{cell}`; POST `/search/operations/{id}/close`; GET `/search/missing-register`; POST `/search/missing-register/{id}/resolve`; POST/GET `/search/incidents`; GET `/search/summary`. These operate search grids, missing-person entries and field incidents under rescue-role guards. |
| Shelters | GET `/shelters/list`, `/{id}`, `/{id}/alternatives`, `/{id}/requirements`; POST `/shelters`, `/{id}/arrivals`, `/{id}/departures`, `/{id}/sync-offline`, `/{id}/status`, `/{id}/requirements`, `/{id}/transfer`; PATCH `/{id}`. Operational access is enforced by `current_user`/role/shelter scope. They derive capacity, log arrivals, create resource requests and support transfers. |
| Relief | GET `/relief/requirements`, `/requests`, `/requests/{id}`, `/inventory`, `/pipeline`; POST `/requests/{id}/approve`, `/reject`, `/commit`, `/dispatch`, `/in-transit`, `/delay`, `/deliver`, `/receive`, `/resolve-discrepancy`, `/distribute`, and `/inventory`. State-machine transitions and role guards cover authority/NGO/shelter actions. |
| Integrity | POST/GET `/integrity/field-reports`; GET `/integrity/conflicts`, `/integrity/data-quality`; POST `/integrity/conflicts/{id}/resolve`. Stores field evidence, detects/reconciles conflicts, and reports staleness/data quality. |
| Ingestion/notifications | POST `/ingestion/poll`, `/ingestion/simulate`, `/notifications/dispatch`, `/notifications/{id}/ack`, `/notifications/escalate-scan`; GET `/ingestion/status`, `/notifications/mine`, `/notifications/monitor`. These use the in-process ingestion adapter/state and Mongo notifications; simulation is an administrator feature, not a live provider connector. |
| Authority | GET `/authority/situation-report`, `/situation-reports`, `/cross-district`, `/decision-log`; POST `/authority/reallocate`, `/escalate`. Authority/super-admin only; aggregates operational data, records decisions/audits and reallocates relief requests. |
| Offline | GET `/offline/policy`, `/offline/bundle`; POST `/offline/sync`, `/offline/sms-fallback`. Provides client bundles/sync processing and records an SMS fallback request; it does not call an SMS provider. |
| Admin | GET `/admin/overview`, `/audit`, `/audit/{object_type}/{object_id}`, `/false-alarm-review`; POST `/admin/override`. Authority/super-admin only; aggregates records, returns audit history and performs audited override. |

The frontend actively calls most citizen/rescue/shelter/NGO/admin routes listed above. Some public operational endpoints (for example `/auth/staff`, governance/state-machine views and several individual detail endpoints) exist in the backend but have no direct frontend call found.

## 10. Major workflows

### Citizen SOS

```text
CitizenSOS → browser geolocation/manual location → POST /sos (Bearer JWT)
  → duplicate/event matching + priority classification + Mongo sos_records + audit
  → SOS view/ticket → citizen UI

Offline: localStorage queue → POST /sos/sync → each accepted item becomes SOS record
```

Rescue leaders query the queue, retrieve team recommendations, and assign a team. Assigned members accept/reject, update team location/status, and complete the SOS; state-machine checks, team state synchronization, audit records, and—when required—search operations are applied by router helpers.

### Shelter and relief

Shelter administrators read their scoped shelter, record arrivals/departures or offline logs, update status/resources, and raise requirements. A requirement creates a Mongo `resource_requests` record. Authority/NGO users approve, commit inventory, dispatch, update transit/delay/delivery/receipt/distribution, and resolve discrepancies. The APIs return updated record views, including derived shelter availability/staleness.

### Event ingestion and citizen alerts

Administrators use simulated/poll ingestion endpoints. The adapter persists events/ingestion state and notification records. A citizen checks their location against event GeoJSON and requests personal alerts; notification acknowledgment updates the stored notification. No external disaster feed call is implemented.

### AI analytics

Public/operational pages submit a selected region, text, image base64, or resource/SOS data. FastAPI sends it to Mistral through `ai_service`; returned strings are displayed directly or wrapped in API fields. Several advisory endpoints deliberately fall back to static guidance; vision and most direct AI endpoints return an error when the provider fails.

## 11. Error handling and security observations

FastAPI/Pydantic supplies request validation; handlers use `HTTPException` for missing data, access denial and state conflicts. Router lifecycle helpers prevent disallowed event/SOS/resource transitions. `audit.py` records mutations and exposes timelines. The frontend commonly catches Axios failures and presents `apiError`/Sonner notifications; several read-only legacy pages silently retain empty state on failure. SSE chat encodes errors as a final event.

Implemented protections: bcrypt password hashing, signed bearer JWTs, DB-backed OTP expiration, role guards, per-resource scope checks in operational routers, CORS middleware, secret names in environment variables, stripping `passwordHash` from returned users, and Mongo IDs removed from views. No rate limiter, Helmet/security-header middleware, CSRF mechanism, CAPTCHA, upload size/type enforcement, server-side token revocation, or real SMS delivery integration was found.

Important risks evidenced by code:

* `JWT_SECRET` falls back to `setu-dev-secret`; production must set it.
* CORS defaults to `*` while `allow_credentials=True`; configure explicit origins.
* OTP is returned in the API response and has no attempt-limit enforcement, so it is demo-only authentication.
* JWT is stored in localStorage, exposing it to successful XSS.
* Image payloads are base64 and forwarded to AI without explicit size/mime validation.
* AI output is largely returned raw; structured-output prompts are not parsed/validated.
* Seeded demo credentials/data are initialized automatically and should never be production defaults.

## 12. File structure and responsibilities

```text
SETU-National-Disaster-Response-Intelligence/
├── frontend/
│   ├── src/{App.js,index.js,context,lib,components,pages}/
│   ├── package.json  craco.config.js  tailwind.config.js  vercel.json
│   └── .env.example
├── backend/
│   ├── server.py  ai_service.py  mock_data.py  requirements.txt
│   ├── setu/{models,db,auth,audit,geo,priority,state_machines,ingestion,seed}.py
│   └── setu/routers/{auth,event,sos,rescue,search,shelter,relief,integrity,
│                     ingestion,authority,offline,governance,admin}_routes.py
├── tests/ and backend/tests/       # scenario, smoke, and state-machine tests
├── render.yaml                     # Render backend service
└── README.md, MIGRATION_AND_DEPLOY.md, memory/  # non-authoritative docs/design material
```

The frontend files described in section 5 are presentation/transport. `server.py` owns legacy routes and application mounting. `setu/models.py` owns types/enums; `db.py` owns collections/indexes; `auth.py` owns JWT/bcrypt/RBAC; `state_machines.py` holds allowed event/SOS/team/resource transitions; `audit.py` writes/query audit logs; `geo.py` performs point/polygon/haversine calculations; `priority.py` classifies SOS priority; `ingestion.py` runs the local ingestion adapter; router files are feature controllers. `seed.py` supplies idempotent demonstration data.

## 13. Dependency analysis

Confirmed source imports/configuration include the frontend/backend packages in the verified stack table, plus the Radix primitives, `cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `vaul`, and `next-themes` imported by generated `components/ui` implementations. These component modules are present in source; only a subset is imported by the active route tree.

Installed but no application-source import/configuration was found: `@hookform/resolvers`, `date-fns`, `dayjs`, `framer-motion`, `lodash`, `swr`, `zod`, and the ESLint configuration packages (no ESLint config file was found). `cra-template` is scaffold metadata. `@types/lodash` is type metadata. Dependency resolutions and lock-related packages are not classified as application technologies. `requests` is imported only by backend test code, not the server implementation. `pytest-xdist` is declared but no parallel-test invocation was found. Docker, Kubernetes, CI workflow, Terraform, cloud SDK, payment SDK, email SDK, and SMS SDK configuration were not found.

## 14. Developer setup

Requirements evidenced by configuration: a Node/Yarn-compatible frontend environment, Python environment able to install `backend/requirements.txt`, and a reachable MongoDB configured with `MONGO_URL` and `DB_NAME`. Mistral-dependent features additionally need `MISTRAL_API_KEY`.

```text
# Backend (from backend/)
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000

# Frontend (from frontend/)
yarn install
# set REACT_APP_BACKEND_URL to the backend origin (example is in .env.example)
yarn start

# Production frontend build
yarn build
```

The backend seeds index/demo data automatically. Render’s production build/start commands are in `render.yaml`. No confirmed frontend deployment build command is stored in `vercel.json`.

## 15. Final verified report

## Verified Tech Stack

### Frontend

* React, ReactDOM, React Router DOM, Axios, TanStack React Query provider, Tailwind/CRACO, Radix-based UI components, Leaflet/React Leaflet, Recharts, Lucide, Sonner.

### Backend

* Python, FastAPI, Uvicorn, Pydantic, Motor/PyMongo, Mistral SDK, python-dotenv.

### Database

* MongoDB, with the collections/indexes and Motor query paths detailed above.

### Languages

* Python, JavaScript/JSX, CSS, HTML, JSON, YAML.

### Frameworks/Libraries

* See the verified stack table; all listed items have source/configuration evidence.

### Cloud/Deployment

* Render configuration for backend; Vercel SPA rewrite for frontend. Mongo and Mistral are configured by environment variables, not a repository-defined hosting account.

### Authentication/Security

* bcrypt, PyJWT HS256 bearer tokens, mock Mongo OTP, FastAPI role dependencies, CORS, Pydantic validation and audit logging.

### Build/Development

* Yarn/CRACO/react-scripts frontend commands; pip/Uvicorn backend commands; pytest test files.

### Other

* Browser localStorage/geolocation/network APIs implement session persistence and offline SOS queueing.

## Verified APIs

### External APIs

* Mistral AI chat/vision — disaster chat, explanations, resource advice, warning/rumor text and image analyses.
* OpenStreetMap tiles — Leaflet base map imagery.

### Internal APIs

* All implemented FastAPI endpoints are inventoried in section 9, covering legacy advisory data plus auth, events, SOS, rescue, search, shelters, relief, integrity, ingestion/notifications, authority, offline, governance and administration.

### Cloud/SDK APIs

* Mistral Python SDK — asynchronous chat completion/stream and vision completion.

## Complete Project Working

The browser initializes React routes and auth context, reads or sends a bearer token through Axios, and displays role-specific disaster workflows. FastAPI validates requests, authenticates/authorizes operational actions, applies domain state machines and audit logging, stores operational records in MongoDB, and returns JSON/SSE that updates page-local state. The legacy analytics UI consumes mock-data endpoints and can call Mistral for AI-generated guidance; Leaflet renders client-side map tiles. Offline SOS data is retained in localStorage until synchronized.

## Architecture

Use the verified diagram in section 4.

## Unverified / Unused

* Mentioned but not implemented: live NDEM/IMD/NDMA/PIB feeds, SMS delivery, live weather/social/medical data, payment/email/storage integrations.
* Installed but unused/unconfirmed: dependencies listed in section 13.
* Configured but not confirmed: Vercel hosting itself (only rewrite configuration), a particular Mongo provider, actual Render/Vercel deployment instances, and health checks unless `ENABLE_HEALTH_CHECK=true`.
* Unclear technologies/APIs: no additional external APIs can be confirmed from the source.
