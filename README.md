## Subscription Manager HK – React + Express Prototype

This repo hosts a dual-login SaaS concept for managing recurring membership payments in Hong Kong. It now ships as a React (Vite) frontend and an Express backend with dummy content so you can replace data or hook into real services later.

### Project Structure

```
client/   # Vite + React UI
server/   # Express API with sample endpoints
```

### Frontend (React)

```
cd client
npm install
npm run dev
```

The UI includes:
- Dedicated `/login` page with Admin/Member cards plus sample credentials.
- `/admin` route for the complete dashboard, members, invoices, reminders, payments, reports, and settings experience.
- `/member` route showing the member dashboard, pay-now flow, invoices, payment history, profile, and user-flow callouts.

### Backend (Express)

```
cd server
npm install
npm run dev
```

Available demo endpoints:
- `POST /api/login` – accepts any email/password and returns a faux token + inferred role.
- `GET /api/metrics` – high-level KPIs for the dashboard.
- `GET /api/members` – member list with outstanding balances.
- `GET /api/invoices` / `POST /api/invoices` – retrieve or append dummy invoices.

### Connecting Frontend & Backend

The Vite dev server proxies `/api/*` calls to `http://localhost:4000`, so running both apps concurrently lets the login buttons hit the Express endpoints immediately.

Feel free to swap out the placeholder data inside `client/src/data.js` and `server/server.js` as you plug in real authentication, billing logic, or integrations. All UI sections are componentized for quick edits. !*** End Patch

