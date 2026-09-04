# SETU Mobile

Expo + TypeScript mobile client for the existing SETU FastAPI backend. This app is a sibling of `frontend/`; it does not create a second backend or database.

## Run

1. Start the existing backend: `cd ../backend` then `uvicorn server:app --host 0.0.0.0 --port 8000`.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_BACKEND_URL`. For a physical device, use the computer's LAN IP instead of `localhost`.
3. Install and start: `npm install`, then `npm start`.
4. Validate types with `npm run typecheck`.

Citizen login uses the existing mocked OTP flow (`/api/auth/otp/request` and `/api/auth/otp/verify`). Staff use the existing email/password login. Server secrets stay in `backend/.env` and are never bundled into this app.

The app uses `/api/events`, `/api/sos`, `/api/shelters`, `/api/rescue`, `/api/notifications`, and `/api/offline`. Backend state remains authoritative; offline records are explicitly marked pending until acknowledged by `/api/sos/sync` or shelter offline sync.
