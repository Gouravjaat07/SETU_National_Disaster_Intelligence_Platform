# SETU — Verified Technical Architecture and Judge Guide

> **Scope and evidence standard.** This document was produced by tracing executable source in this repository. A dependency, README statement, comment, or deployment file alone is not treated as proof of runtime use. `backend/server.py` contains an earlier dashboard API; `backend/setu/routers/` is the role-based operational subsystem mounted by the same FastAPI application. Both are executable and mounted. Line numbers may move; each claim names the file and callable that implements it.

## 1. Project overview

SETU is a disaster-response coordination web application. It gives citizens a way to authenticate, view event-related alerts, find shelters, submit and cancel SOS requests, and use an offline SOS queue. It gives rescue, shelter, NGO, and authority roles separate dashboards to manage SOS cases, teams, shelters, relief requests, field/search records, source-ingestion simulations, conflicts, notifications, and audit history.

The implemented operational workflow is centered on **human-controlled response coordination**. A deterministic server-side priority function ranks SOS records; state machines constrain lifecycle changes; MongoDB preserves operational records and audit entries; an optional Mistral integration produces advisory text and vision/text analyses. AI does not change an SOS, disaster event, shelter, or resource state on its own (`backend/setu/advisory.py`).

### End-to-end flow

```text
Citizen / operator in a browser
        ↓
React single-page application (routes, role gates, Axios/fetch)
        ↓ HTTPS JSON / SSE
FastAPI (`backend/server.py` + `/setu/routers`)
        ├─ MongoDB via Motor: operational records, OTPs, audit data
        ├─ Deterministic local logic: geo checks, SOS priority, state machines,
        │  shelter ranking, simulation and route estimates
        ├─ Mistral API via `mistralai`: optional text/vision/advisory output
        └─ In-memory `mock_data.py` / simulated ingestion queue: dashboard demo data
        ↓
JSON or Server-Sent Events returned to the React UI
```

**Target users:** citizens, rescue leaders and members, shelter administrators, NGO administrators, authorities, and super administrators. The roles and their protected frontend routes are defined in `frontend/src/App.js`; backend enforcement is `backend/setu/auth.py` → `require_roles()`.

## 2. Complete verified technology stack

| Category | Technology | Version evidenced | Actually used? | Where used | Purpose |
|---|---|---:|---|---|---|
| Frontend | React | 19.0.0 | Yes | `frontend/src/index.js`, `App.js`, pages/components | SPA UI |
| Routing | React Router DOM | 7.15.0 | Yes | `App.js`, `ProtectedRoute.jsx` | Browser routes and client role gates |
| HTTP client | Axios | 1.18.0 | Yes | `src/lib/api.js`, `setuApi.js`, pages | REST calls and Bearer-token interceptor |
| Query cache | TanStack React Query | 5.56.2 | Yes | `src/index.js` → `QueryClientProvider` | Provides a configured query client |
| UI primitives | Radix UI | individual packages 1.x/2.x | Yes | `src/components/ui/*.jsx` imports | Accessible component primitives |
| Styling | Tailwind CSS + PostCSS | 3.4.17 / 8.5.10 | Yes | `tailwind.config.js`, `index.css`, JSX classes | Styling and animations |
| Icons / notifications | Lucide React / Sonner | 0.516.0 / 2.0.3 | Yes | layout/pages; `App.js` | Icons and toast messages |
| Map | Leaflet + React Leaflet | 1.9.4 / 5.0.0 | Yes | `components/map/FloodMap.jsx` | Interactive map overlays |
| Map tiles | OpenStreetMap and OpenTopoMap tile endpoints | URL-based | Yes | `FloodMap` → `TileLayer` | Basemap imagery |
| Charts | Recharts | 3.6.0 | Yes | dashboard/prediction pages import it | Charts for demo/dashboard data |
| Forms | React Hook Form | 7.56.2 | Yes | `components/ui/form.jsx` | Form context/controller primitives |
| Runtime/build | Node.js, CRACO, Create React App scripts | CRACO 7.1.0 / react-scripts 5.0.1 | Yes | `package.json`, `craco.config.js` | Start/build frontend and alias configuration |
| Backend | Python + FastAPI | FastAPI 0.110.1 | Yes | `backend/server.py`, routers | Async REST/SSE API |
| ASGI runtime | Uvicorn | 0.25.0 | Configured for deployment | `render.yaml` start command | Runs FastAPI when deployed |
| Validation | Pydantic | >=2.6.4 | Yes | request/model classes in server and routers | Request/model validation and serialization |
| Database | MongoDB | provider/version not verified | Yes, needs environment connection | `setu/db.py`; legacy `server.py` Motor client | Persistent document collections |
| Mongo async driver | Motor / PyMongo | 3.3.1 / 4.6.3 | Yes | `db.py`, `server.py` | Async MongoDB access |
| Authentication | JWT + bcrypt | PyJWT >=2.10.1 / bcrypt 4.1.3 | Yes | `setu/auth.py`, `auth_routes.py` | Signed sessions and password hashing |
| Environment config | python-dotenv | >=1.0.1 | Yes | `server.py` → `load_dotenv()` | Loads backend `.env` |
| AI | Mistral AI SDK | mistralai 2.9.4 | Yes when key is supplied | `backend/ai_service.py` | Text streaming/completion and vision completion |
| Tests | pytest | >=8.0.0 | Yes | `tests/`, `backend/tests/` | Python behavior/smoke testing |

Framer Motion, SWR, Zod, lodash, and date libraries are declared but **not verified as used in application source**. `requests` is installed but not verified as used. There is no verified ORM/ODM, Redis, task queue, Dockerfile, GitHub Actions workflow, Firebase, AWS, Azure, Google Maps, Mapbox, or cloud database provider.

## 3. APIs and services actually called

| API/service | Provider/type | Exact implementation | Input → output | Why SETU uses it |
|---|---|---|---|---|
| SETU REST API | Internal FastAPI JSON | React Axios clients in `src/lib/api.js` and `src/lib/setuApi.js` → `backend/server.py` and `setu/routers/*` | JSON request models → JSON response models/documents | Connects UI to coordination logic and persisted records |
| SETU chat SSE | Internal FastAPI SSE | `pages/Chatbot.jsx` `fetch()` → `POST /api/chat/stream` → `chat_stream()` | `{session_id,message,lang}` → `data: {delta}` chunks and `{done:true}` | Streams assistant output without waiting for a complete response |
| Mistral chat/completion | Mistral AI SDK / external LLM API | `ai_service.generate_text()` and `stream_chat()` | System/user messages → text | Advisory summaries, XAI explanation, allocation/warning text, rumor check, chatbot |
| Mistral vision | Mistral AI SDK / external multimodal API | `ai_service.analyze_image()` | Prompt plus base64 image data URL → text (requested JSON is not parser-enforced) | Damage, water-depth, and flood-image classifications |
| Browser Geolocation | Browser Web API | `offlineQueue.acquireLocation()`, `SOS.jsx`, `Shelters.jsx` | Browser coordinate position → latitude/longitude/accuracy | Attach a citizen location to SOS and shelter lookup |
| OpenStreetMap raster tiles | OpenStreetMap / external HTTP tiles | `FloodMap.jsx` `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | Tile coordinates → tile images | Render a standard basemap |
| OpenTopoMap raster tiles | OpenTopoMap / external HTTP tiles | `FloodMap.jsx` `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png` | Tile coordinates → terrain tile images | Alternative terrain basemap |

There is **no verified call** to a weather provider, real NDEM endpoint, NDMA/IMD/PIB endpoint, SMS/OTP provider, social-media provider, geocoder/reverse geocoder, routing engine, push-notification service, or a live ML prediction service. The UI dashboard values for weather, predictions, social posts, drones, alerts, etc. come from `backend/mock_data.py`.

### Important internal API flows

```text
SOS: CitizenSOS.jsx → POST /api/sos → sos_routes.create_sos_record()
 → deterministic `classify_priority()` + Mongo `sos_records` + audit_log
 → ticket/status JSON → citizen and rescue dashboards

AI advisory: LeaderDashboard.jsx → GET /api/rescue/ai-summary
 → rescue_routes.ai_summary() → advisory.queue_summary()
 → Mistral (or deterministic fallback) → advisory-marked JSON → leader UI

Damage image: Damage.jsx → POST /api/damage/estimate
 → server.damage_estimate() → ai_service.analyze_image() → Mistral vision
 → raw model text → UI (not stored by this endpoint)

Event ingestion demo: IngestionConsole.jsx → POST /api/ingestion/simulate
 → ingestion.queue_feed_items() → POST /api/ingestion/poll → ingestion.poll()
 → Mongo disaster_events/conflicts/audit_log → console and authority views
```

## 4. Mistral / AI analysis

**Provider and models.** `backend/ai_service.py` creates `Mistral(api_key=MISTRAL_API_KEY)`. It reads `MISTRAL_API_KEY`, `MISTRAL_MODEL` (default `mistral-large-latest`), and `MISTRAL_VISION_MODEL` (default `pixtral-12b-latest`) from the environment. The app loads `backend/.env` in `server.py`; deployment configuration also declares those variables in `render.yaml`.

| Use case | Backend callable / endpoint | Model call and data | Result handling |
|---|---|---|---|
| Chatbot | `server.py` `chat_stream()`, `chat_message()` | User message + `DISASTER_SYSTEM_PROMPT`; `chat.stream_async` or `chat.complete_async` | SSE deltas or `{response, session_id}`; no DB storage shown |
| Forecast explanation | `explain_prediction()` → `/prediction/explain` | Region name/river/population, mock forecast and mock factor weights | Plain text; uses a hard-coded fallback if AI fails |
| Resource suggestion | `optimize_resources()` | Serialized in-memory resource inventory/allocation | Text suggestion; no DB mutation |
| Image damage/depth/classification | `damage_estimate`, `water_depth_estimate`, `image_classify` | Base64 user image plus task prompt/context, sent as an image URL data URI | Returns `{raw}`; requested JSON remains raw text, not validated/parsed |
| Rumor check | `fakenews_check()` | User text and optional source | Returns raw requested-JSON text; not independently fact checked |
| Early warning | `warning_generate()` | Mock regional prediction inputs | Returns raw requested-JSON text; fallback builds Hindi/English string JSON |
| Rescue advisories | `setu/advisory.py`: `queue_summary`, `cluster_naming`, `duplicate_hint` | Active SOS and team/cluster operational fields | Wrapped with `advisory:true`, `requiresHumanConfirmation:true`, fallback behavior |

The system prompt asks for calm, multilingual, safety-oriented assistance and says to call 1078 in a life-threatening emergency. The advisory module separately states that it cannot declare/cancel disasters or mutate operational state. In contrast, the legacy AI endpoints are capable of producing unvalidated text; their output is not a verified source of truth.

**Complete AI pipeline:** UI/request data → FastAPI endpoint → prompt construction → `ai_service` → Mistral SDK → text returned to endpoint → raw text/SSE or advisory wrapper returned to UI. Only the AI-advisory call sites explicitly guarantee deterministic fallbacks. AI responses are **not verified as stored in MongoDB**.

## 5. Location and mapping

The browser obtains coordinates through `navigator.geolocation`. `offlineQueue.acquireLocation()` tries high-accuracy GPS first, then a lower-accuracy request labelled `NETWORK`, then `localStorage` last-known coordinates; callers can provide manual/landmark locations through the Pydantic `Location` model. This is not an IP-location provider or address lookup.

Coordinates are sent in an SOS `origin`/`lastKnown` object (`CitizenSOS.jsx` → `/api/sos`) and team location (`MemberDashboard.jsx` → `/api/rescue/teams/{id}/location`). They are embedded in Mongo documents. `setu/geo.py` implements Haversine distance and a pure-Python point-in-polygon check against stored GeoJSON event areas. `/api/events/check-location` uses it to return `AFFECTED`, `NEAR_BOUNDARY`, or `OUTSIDE_KNOWN_AREA`; its message explicitly says outside a known area is not confirmation of safety.

`FloodMap.jsx` uses React Leaflet layers to display supplied village points, shelters, road closures, and an optional polyline. Its input is internal map data; it does not call a route/maps API. Legacy shelter recommendation and rescue-route endpoints also use local Haversine math and generated waypoints—not a routing engine. Reverse geocoding and address conversion are **not verified in the codebase**.

## 6. Database deep analysis

**Database:** MongoDB, selected through required `MONGO_URL` and `DB_NAME` environment variables (`setu/db.py`; legacy `server.py`). The async driver is Motor. There is no ORM/ODM: Pydantic models define application validation, while Mongo operations use collections directly. `ensure_indexes()` declares unique IDs and a small set of query indexes, but this function is **not verified as called on startup**.

| Model / collection | Key fields / role |
|---|---|
| `users` / `User` | `userId`, mobile/email, `passwordHash`, role, profile, home/last-known location, team/shelter/NGO links |
| `otp_codes` | mobile, demo OTP code, attempts, expiry |
| `disaster_events` / `DisasterEvent` | source/reference, type, severity, info tier/status, GeoJSON affected area, zones, source quality, version/history |
| `sos_records` / `SOSRecord` | immutable origin, last location, people/injury counts, emergency type, status/priority, assignment history, offline timestamps/media metadata |
| `teams` / `Team` | leader/members, current location, vehicle/capabilities/equipment, operational state |
| `shelters` / `Shelter` | location, capacity/occupancy, food/water/medical state, availability derived on read |
| `resource_requests` / `ResourceRequest` | request and fulfilled quantities, relief lifecycle, NGO/shelter/event references, discrepancies |
| `audit_log` / `AuditEntry` | actor, action, affected object, old/new values, device/IP/note |
| Search/field collections | `search_operations`, `field_incidents`, `missing_register`, `road_incidents`, `field_reports`, `conflicts` support search, verification, road, and integrity workflows |
| Coordination collections | `notifications`, `arrival_logs`, `ngo_inventory`, `ingestion_state`, `situation_reports` support alerts, shelter operations, supplies, ingestion and reports |
| Legacy-only collections | `sos_reports`, `volunteers`, `family_checkins` are directly accessed in `server.py` legacy endpoints; they are not listed in `setu/db.py` |

**Write/read path:** frontend → protected route → Pydantic request model → router function → Motor collection operation → often `record_audit()` → response with `_id` stripped through `clean()`. For a new SOS, `sos_routes.py` additionally checks event context, deterministic priority, duplicate/location behavior, and lifecycle transitions. Seed data is inserted by `setu/seed.py` during `server.py` startup and is explicitly demo data.

## 7. Frontend architecture and user journey

Entry is `src/index.js`; `App.js` mounts `AuthProvider`, `BrowserRouter`, `AppShell`, `ProtectedRoute`, and Sonner. The token is stored in `localStorage` under `setu.token`; `setuApi` adds it as `Authorization: Bearer …` and logs out on 401. This client gate improves navigation, but backend `require_roles()` is the actual access control.

| Area/page components | File(s) | Data/API purpose |
|---|---|---|
| Public dashboard | `Home`, `Dashboard`, `LiveMap`, `Prediction`, `Resources`, `Simulation`, `Damage`, `Chatbot` | Legacy dashboard endpoints, map layers, AI calls and SSE chat |
| Citizen workflow | `pages/citizen/CitizenHome`, `CitizenSOS`, `ShelterFinder` | Alerts, event-location check, authenticated SOS, offline queue/sync, shelter list |
| Rescue workflow | `pages/rescue/LeaderDashboard`, `MemberDashboard`, `SearchOperations` | SOS queue/assignment/status, teams, clusters, advisory summary, blocked roads and search records |
| Shelter/NGO workflow | `pages/shelter/ShelterAdminPortal`, `pages/ngo/NgoPortal` | Occupancy, requirements, transfer, arrival, relief request and inventory transitions |
| Authority workflow | `pages/admin/AdminPortal`, `IngestionConsole`, `ConflictsPage`, `SituationReport` | Events, audit, simulated ingestion, notifications, integrity conflicts, authority decisions |
| Shared map/UI | `components/map/FloodMap`, `components/ui/*`, `layout/*` | Leaflet layers; Radix-based components, icons, alert ticker |

Loading/error behavior is local to pages: most Axios calls have `.catch()` and state-based loading/error text. The error helper is `apiError()` in `setuApi.js`. `index.js` mounts a configured TanStack Query client, though page data fetching is mostly direct Axios rather than query hooks. Browser `localStorage` holds authentication, offline SOS items and last-known location.

## 8. Backend architecture and route inventory

`server.py` creates FastAPI, mounts legacy `api_router` at `/api`, imports/mounts every newer router, adds CORS, seeds demo data at startup, and closes its legacy Motor client at shutdown. The newer routers encapsulate route behavior; there is no separate controller/service directory beyond helpers such as `auth.py`, `geo.py`, `priority.py`, `advisory.py`, `ingestion.py`, and `audit.py`.

| Route family | Methods and endpoint suffixes | File | Purpose |
|---|---|---|---|
| Legacy dashboard | `GET /`, `/overview/stats`, `/alerts/ticker`, `/regions`, `/monitoring/map-data`, `/prediction/{id}`, `/predictions/all`, `/resources`, `/incidents`, `/volunteers`, `/social/monitor`, `/weather`, `/medical/outbreak`, `/economic-loss`, `/preparedness`, `/emergency-contacts`, `/drones`, `/family-registry`; `POST` prediction explain, optimize, shelter recommend, three image endpoints, fake-news, chat stream/message, legacy SOS, volunteer, simulation, rescue route, family registry, warning | `server.py` | Dashboard/demo data, lightweight calculations, legacy Mongo writes and Mistral features |
| Authentication | `POST /api/auth/otp/request`, `/otp/verify`, `/login`, `/location`, `/staff`; `GET /me`, `/roles`; `PATCH /profile` | `auth_routes.py` | Mock citizen OTP, staff password login, profile/location and staff creation |
| Events | `GET /api/events`, `/{id}`, `/alerts/for-me`, `/state-machines`; `POST /{id}/transition`, `/events/check-location` | `event_routes.py` | Event lifecycle, event geography and per-user alerts |
| SOS | `POST /api/sos`, `/sync`, `/{id}/cancel`, `/{id}/assign`, `/timeout-scan`, `/{id}/accept`, `/reject`, `/status`, `/complete`; `GET /mine`, `/queue`, `/assigned-to-me`, `/{id}`, `/{id}/timeline`; `PATCH /{id}/location` | `sos_routes.py` | SOS lifecycle, queue, assignment, offline reconciliation and timeline |
| Rescue | `GET /api/rescue/dashboard`, `/teams`, `/recommendations/{id}`, `/clusters`, `/ai-summary`, `/blocked-roads`; `POST /teams`, `/teams/{id}/location`, `/teams/{id}/status`, `/blocked-road` | `rescue_routes.py` | Teams, assignment recommendations/clusters, advisory summary and road reports |
| Search | `POST /api/search/operations`, `/{id}/cells/{cell}`, `/{id}/close`, `/missing-register/{id}/resolve`, `/incidents`; `GET /operations`, `/{id}`, `/missing-register`, `/incidents`, `/summary` | `search_routes.py` | Grid search, missing-person resolution and field incident records |
| Shelters | `GET /api/shelters/list`, `/{id}`, `/{id}/alternatives`, `/{id}/requirements`; `POST /`, `/{id}/arrivals`, `/departures`, `/sync-offline`, `/status`, `/requirements`, `/transfer`; `PATCH /{id}` | `shelter_routes.py` | Shelter registry, occupancy and resource requests/transfers |
| Relief | `GET /api/relief/requirements`, `/requests`, `/{id}`, `/inventory`, `/pipeline`; `POST` approve/reject/commit/dispatch/in-transit/delay/deliver/receive/resolve-discrepancy/distribute a request and `/inventory` | `relief_routes.py` | NGO inventory and controlled relief-request lifecycle |
| Integrity | `POST /api/integrity/field-reports`, `/conflicts/{id}/resolve`; `GET /field-reports`, `/conflicts`, `/data-quality` | `integrity_routes.py` | Evidence/conflict/data-quality operations |
| Ingestion/notifications | `POST /api/ingestion/poll`, `/simulate`, `/notifications/dispatch`, `/{id}/ack`, `/notifications/escalate-scan`; `GET /ingestion/status`, `/notifications/mine`, `/monitor` | `ingestion_routes.py` | Simulated feed reconciliation and in-app notification records |
| Authority/admin/governance/offline | `/api/authority` situation report/reallocation/cross-district/escalation/decision log; `/api/admin` overview/audit/override/false-alarm review; `/api/governance` advisory registry/design rules/compliance report; `/api/offline` policy/bundle/sync/sms-fallback | corresponding router files | Coordination oversight, audit/governance, offline bundle/sync. `sms-fallback` stores/returns a fallback record; no SMS is sent. |

Request lifecycle is FastAPI routing → optional `HTTPBearer` → `current_user()` JWT validation → `require_roles()` where declared → Pydantic validation → router/helper → MongoDB/Mistral/local logic → JSON/SSE response. `HTTPException` is used for known failures; Mistral fallbacks vary by endpoint as described above.

## 9. Disaster-management workflow: implemented versus simulated

| Capability | What is implemented | Important boundary |
|---|---|---|
| Detection / information intake | `ingestion.py` reconciles queued feed items, source references, versions, illegal status jumps and conflicts | The only adapter is a simulated NDEM/authorized-feed queue; no live source connection is present |
| Location awareness | Browser coordinates, location persistence, Haversine and GeoJSON containment | No address geocoding or live tracking transport layer |
| Risk / intelligence | Deterministic SOS priority (`priority.py`), event-zone check (`geo.py`), basic rainfall multiplier simulation | Forecasts/factors are mock data; not a trained predictive model |
| AI assistance | Mistral text/vision and explicitly advisory rescue functions | AI output is not authoritative; some endpoint output is raw/unvalidated |
| Emergency planning | Shelter score, rescue ETA/waypoint estimate, resource advice and lifecycle processes | Route is generated locally and does not use road-network optimization |
| Resources | Shelters, requirements, NGO inventory, reallocation, lifecycle/discrepancy handling | Inventory is database/demo operational data, not a live logistics integration |
| Alerts | Event-related in-app notifications/acknowledgements and legacy ticker | No verified SMS, cell broadcast, email, or push provider |
| Visualization | Leaflet map overlays and dashboard charts | Map points and predictions are demo/mock data unless records are added through workflow |
| Persistence | MongoDB entities and audit log | Availability depends on MongoDB environment configuration |

## 10. Why the actual stack fits SETU

| Technology | Why it fits the implemented design | Benefit |
|---|---|---|
| React + React Router | The app has multiple role-specific portals and reusable UI panels | Fast client-side navigation and clear role journeys |
| FastAPI + Pydantic | The system has many structured, role-protected JSON workflows | Async endpoints and input validation close to route definitions |
| MongoDB + Motor | SOS, events, audits and operational entities are document-shaped and include nested locations/history | Flexible nested records with async access |
| JWT + bcrypt | Staff/citizen identity is required before operational actions | Backend-enforced authenticated role access and hashed staff passwords |
| Leaflet + OSM/OpenTopoMap | Incident, shelter and road point overlays need a map | Lightweight open tile basemaps without a proprietary map SDK |
| Mistral | The code needs streamed multilingual help plus optional narrative/vision analysis | Advisory text and image analysis without embedding a model in the app |
| Deterministic local rules | SOS priority and state transitions are safety-critical | Auditable behavior that does not depend on an LLM |

## 11. Why each verified external API is necessary

| API | Why needed | What would be difficult without it |
|---|---|---|
| Mistral text/vision | Natural-language, multilingual advisory output and image interpretation | Generating contextual explanations, chat, summaries and image reports would require building/training equivalent models |
| Browser Geolocation | Captures browser-provided coordinates for SOS/shelter workflows | Manual location entry would dominate and nearby/event-area logic would be weaker |
| OpenStreetMap/OpenTopoMap tiles | Supplies map imagery behind internal overlays | The app would have no geographic visual context unless it hosted its own tiles |
| Internal FastAPI API | Centralizes persistence, validation, role access and calculations | The browser could not safely coordinate shared operational state |

## 12. Architecture diagram

```text
 [Citizen | Rescue | Shelter | NGO | Authority]
                    |
                    v
 [React 19 SPA: Router, protected pages, Axios/fetch, local offline queue]
          | REST JSON / Bearer JWT          | browser Geolocation
          v                                 v
 [FastAPI application: `server.py` + mounted `setu/routers`]
          |                 |                    |
          v                 v                    v
 [MongoDB via Motor] [local deterministic] [Mistral SDK] ---> Mistral API
 users/SOS/events/...  geo/priority/state       text/vision (optional)
 audit log             machines/simulation
          ^
          |
 [mock_data.py and simulated ingestion queue]  (demo data; not live feeds)

 [FloodMap] ----------------------------------> OSM / OpenTopoMap tile servers
```

## 13. Security analysis

Implemented controls include environment-sourced Mongo/Mistral/JWT configuration; password hashing with bcrypt; JWT expiry (72 hours); Bearer-token validation; backend role checks; Pydantic input models; CORS middleware; `clean()`/`public_user()` response filtering; and audit logging for the newer operational write paths.

Relevant demo limitations:

- `JWT_SECRET` defaults to `setu-dev-secret` if absent (`setu/auth.py`), unsafe outside development.
- Citizen OTP is deliberately mock: the API returns the OTP and no SMS provider is wired (`auth.py` → `generate_otp`).
- No rate limiting, refresh/revocation mechanism, CSRF strategy, or production secret-management integration was verified.
- CORS defaults to `*` while credentials are allowed unless `CORS_ORIGINS` is configured (`server.py`); deployment must set explicit origins.
- Base64 images and model output have no demonstrated size/content guard or schema parsing; raw model output should not be treated as facts.
- The frontend stores the JWT in `localStorage`, so an XSS vulnerability could expose it.
- Legacy endpoints (including legacy SOS) are not uniformly protected by the newer RBAC system.

## 14. Current implementation limitations

- Disaster, weather, prediction, social, drone, map and other dashboard values are primarily static mock/demo data.
- The NDEM-labelled ingestion module does not make an external network request; only authority-triggered simulation puts items in a Mongo queue.
- “AI damage,” water-depth, rumor verification and warnings depend on Mistral output and some are returned as raw strings, without validation or independent factual verification.
- The flood simulation is a simple rainfall multiplier; it is not a verified hydrological/ML model.
- Rescue routing estimates distance and fabricated intermediate points; no live roads, traffic, elevation, navigation or dispatch provider is connected.
- Notifications and SMS fallback are database/application records only; no delivery provider is integrated.
- Mongo availability, indexes, backup, scaling topology and deployment health are not verified in the codebase.
- Client offline support is a local SOS queue, not a service worker/PWA or guaranteed offline map/data experience.

## 15. Future improvements (not currently implemented)

- Replace the simulated ingestion adapter with authenticated, monitored authoritative feeds and source-level operational SLAs.
- Add a verified notification delivery channel (SMS/cell broadcast/push) with consent, delivery status and retries.
- Use validated structured model output plus human review for AI-derived assessments.
- Integrate authoritative road, weather, hydrology and shelter data; distinguish measured, forecast and simulated information in the UI.
- Add rate limits, explicit production CORS, secret rotation, secure token storage/refresh, monitoring, backups and load testing.
- Build PWA/offline maps and resilient sync conflict resolution for field usage.

## 16. Likely judge questions and evidence-based answers

1. **What does SETU solve?** It coordinates the journey from a citizen SOS through triage, team assignment, shelter/relief operations and audit history in one role-based web system.
2. **Is disaster detection live?** No. The code implements a versioned ingestion workflow, but its present input is a simulated queue, not a live government feed.
3. **Why React?** The actual app has many role-specific views, protected routes and reusable map/UI components.
4. **Why FastAPI?** It exposes the many validated async JSON workflows and the streaming chat endpoint.
5. **Why MongoDB?** The implemented records contain nested locations, histories, audit snapshots and varied operational metadata.
6. **How is an SOS prioritized?** `priority.classify_priority()` deterministically scores emergency type, injuries, group size, children, elderly people, accessibility, event severity and battery; it is not an LLM decision.
7. **Can AI dispatch a team?** No. `advisory.py` labels output as advisory and requiring human confirmation; state-changing routes use role checks and state machines.
8. **What does Mistral do?** It powers optional chat, explanatory/advisory text and image analysis through `ai_service.py`.
9. **What happens if Mistral fails?** Rescue advisory calls have deterministic fallbacks; forecast/resource/warning legacy calls also fall back. Image and rumor endpoints return 500 on failure.
10. **How is hallucination controlled?** AI is explicitly advisory only for rescue functions; deterministic rules own priority/lifecycles. Raw legacy model outputs are a known limitation and need validation/human review.
11. **How is location obtained?** Browser Geolocation, with high-accuracy, lower-accuracy and last-known local fallback in `offlineQueue.js`.
12. **Do you reverse-geocode addresses?** Not verified in the codebase.
13. **What map API do you use?** React Leaflet renders OpenStreetMap and OpenTopoMap tiles; SETU overlays its own data.
14. **Do you use a live routing API?** No. Route estimates are calculated locally with Haversine distance and generated waypoints.
15. **How does offline SOS work?** The browser stores an SOS with original local time in `localStorage`, then posts a batch to `/api/sos/sync` on reconnection.
16. **How is access controlled?** JWT Bearer authentication and server-side `require_roles()` protect newer operational routes; frontend route gates are only convenience.
17. **How are passwords protected?** Staff passwords are hashed/verified with bcrypt. Citizen OTP is a clearly marked demo mock, not SMS delivery.
18. **What data is persisted?** Users, SOS, teams, shelters, requests, events, notifications, audits and related operational records in MongoDB.
19. **Is the prediction engine trained ML?** Not verified. The dashboard prediction values are mock data and flood simulation is a linear calculation.
20. **How do you keep an event feed trustworthy?** The ingestion code preserves source references and history, detects same/older-version contradictions, and records conflicts for human review.
21. **What is the most important safety design decision?** AI cannot automatically change response state; deterministic state machines, roles and audit records control operational transitions.
22. **Can it scale nationally today?** Not verified. It has an async API/document-store design, but no demonstrated capacity testing, clustering, cache, queue, backup or live source integration.

## 17. 60-second technical pitch

“SETU is a role-based disaster-response coordination platform. A citizen can sign in, share browser location, submit an SOS, and still queue that SOS locally if connectivity drops. The React frontend routes citizens, rescue teams, shelters, NGOs and authorities into focused dashboards. The FastAPI backend validates requests, enforces JWT roles, ranks SOS cases deterministically, applies lifecycle rules, and stores operational records plus audit history in MongoDB. We use Leaflet with OpenStreetMap and OpenTopoMap tiles to visualize local incident, shelter and road overlays. Mistral is used only for optional multilingual help, summaries and image analysis; it is advisory, while priority and operational state remain human-controlled and auditable. Today the event and analytics feed is demonstrative mock/simulated data, so SETU’s strongest implemented value is the response-coordination workflow rather than a claim of live disaster prediction.”

## 18. 2-minute technical pitch

“SETU is designed around the operational handoff that is often fragmented during a disaster: a citizen reports an emergency, a response team prioritizes and accepts it, shelters track capacity and requests, NGOs move relief, and authorities retain an auditable picture of decisions. The frontend is a React single-page application with distinct protected portals for those roles. It uses Axios for REST calls, browser Geolocation for coordinates, a local offline SOS queue for loss of connectivity, and Leaflet with OpenStreetMap or OpenTopoMap tiles for visualization.

On the backend, FastAPI and Pydantic define the API contracts. MongoDB, accessed asynchronously through Motor, stores SOS records, event data, teams, shelters, resource requests, notifications and audit logs. JWT and bcrypt handle staff authentication; newer operational endpoints enforce roles server-side. An SOS is ranked by deterministic factors such as emergency type, injuries, vulnerable people and battery—not by AI—and state machines guard transitions such as assignment and completion.

Mistral is integrated through its official SDK for multilingual chat, optional rescue-leader summaries and image/text analysis. We deliberately treat it as advisory: the rescue-advisory response says human confirmation is required and has deterministic fallbacks. SETU also has an ingestion architecture that versions authoritative event records and surfaces contradictory updates for review. In this repository, that feed is simulated and several analytics panels use mock data, so we present the prototype honestly: it is a working coordination and governance foundation ready to be connected to vetted live data sources, not a production claim of real-time prediction.”

## 19. Final technology summary

| Layer | Actual technology | Main role |
|---|---|---|
| Frontend | React, React Router, Axios, TanStack React Query, Tailwind, Radix UI | Role-based browser UI |
| Backend | Python, FastAPI, Pydantic, Uvicorn deployment command | API, validation and SSE |
| Database | MongoDB via Motor/PyMongo | Operational documents and audits |
| AI | Mistral SDK; Mistral text and Pixtral vision model defaults | Optional text/vision/advisory features |
| Location | Browser Geolocation, local Haversine/GeoJSON helpers | SOS/location/event matching |
| Maps | Leaflet/React Leaflet; OSM/OpenTopoMap tiles | Geographic display |
| External APIs | Mistral, OSM tiles, OpenTopoMap tiles | AI and map rendering |
| Deployment configuration | Render service config; Vercel SPA rewrite config | Configured deployment targets, not deployment proof |

## VERIFIED — ACTUALLY USED

- React, React Router, Axios, TanStack React Query, Tailwind CSS, Radix UI primitives, Lucide icons, Sonner, Leaflet/React Leaflet, Recharts and React Hook Form in executable frontend source.
- FastAPI, Pydantic, Motor MongoDB access, bcrypt, PyJWT, python-dotenv and pytest in executable backend/test source.
- MongoDB collection operations for the newer operational subsystem and some legacy workflow data, conditional on configured environment variables.
- Mistral SDK calls for chat, text generation and image analysis, conditional on `MISTRAL_API_KEY` being supplied.
- Browser Geolocation and `localStorage` offline/auth mechanisms.
- OpenStreetMap and OpenTopoMap tile URLs in the rendered map component.

## CONFIGURED BUT NOT VERIFIED AS USED

- Render and Vercel: configuration files exist (`render.yaml`, `frontend/vercel.json`), but a deployed service is not verified from the repository.
- Uvicorn is a Render start command but no local process execution is shown here.
- `ensure_indexes()` exists in `setu/db.py`; a caller was not found.
- Framer Motion, SWR, Zod, lodash, `requests`, and various declared frontend packages have no verified application-source use. TanStack React Query is mounted at the frontend entry point, but query-hook use was not found in the inspected pages.
- CRACO conditionally references Emergent visual-edits/health-check modules, but the plugin is optional/configuration-gated and its dependency/runtime use is not verified.

## NOT USED / NOT FOUND

- No verified live NDEM/NDMA/IMD/PIB/weather/disaster-data API call.
- No verified real SMS, email, push notification, cell broadcast, social-media, reverse-geocoding, IP-geolocation, Google Maps, Mapbox, routing/navigation, traffic, or live road API.
- No verified custom trained ML model, TensorFlow, PyTorch, scikit-learn, Hugging Face, OpenAI, Azure OpenAI, or vector database.
- No verified ORM/ODM, Redis, Celery/background worker, WebSocket implementation, Dockerfile, GitHub Actions, AWS, Azure, Firebase, Cloudinary, or external authentication provider.
