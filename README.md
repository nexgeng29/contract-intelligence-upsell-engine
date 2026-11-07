# contract-intelligence-upsell-engine
Contract intelligence platform that analyzes agreements to detect renewal signals, clause insights, and cross-sell/upsell opportunities

## Project structure

- `frontend/` — React application built and served with Vite
- `backend/` — Node.js HTTP API

## Getting started

Requires Node.js 20.19+.

```sh
npm install
```

In separate terminals, start the API and frontend:

```sh
npm run start:backend
npm run dev:frontend
```

The frontend is available at the URL printed by Vite and proxies `/api` requests to the backend on port 3001. If you change the backend's `PORT`, set `BACKEND_URL` to the corresponding URL when starting Vite.

Run the frontend production build and backend tests with:

```sh
npm run build
npm test
```
