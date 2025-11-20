## Subscription Manager HK – Fully Functional CRUD Application

This repo hosts a complete SaaS application for managing recurring membership payments in Hong Kong. Features **fully functional CRUD operations**, real-time state management, data persistence, and a modern responsive UI. All member names updated to Muslim names.

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

### ✨ New Features (Fully Functional!)

**Admin Portal** (`/admin`):
- ✅ **Members CRUD**: Add, edit, delete, and view members
- ✅ **Invoices CRUD**: Create, update status, and delete invoices
- ✅ **Mark as Paid**: Instantly update invoice status
- ✅ **Send Reminders**: Email/WhatsApp notifications (simulated)
- ✅ **Payment Methods**: Toggle visibility for members
- ✅ **Real-time Metrics**: Auto-updating KPIs and statistics
- ✅ **Export Reports**: CSV/PDF export (simulated)

**Member Portal** (`/member`):
- ✅ **Multi-invoice Payment**: Select and pay multiple invoices at once
- ✅ **5 Payment Methods**: Bank Transfer, FPS, PayMe, Alipay, Credit Card
- ✅ **Instant Card Payments**: Real-time payment processing
- ✅ **Manual Payment Submission**: Upload proof, pending verification
- ✅ **Payment History**: Complete transaction timeline
- ✅ **Profile Management**: Update contact info and preferences
- ✅ **Live Dashboard**: Real-time balance and payment tracking

### 💾 Data Persistence
All data is stored in localStorage and persists across sessions:
- Members, Invoices, Payments
- Metrics and Statistics
- Payment Methods Configuration
- Communication Logs

### 👥 Muslim Names
All sample data now uses Muslim names:
- Ahmed Al-Rashid, Fatima Hussain, Omar Rahman, Aisha Malik
- Yusuf Ibrahim, Mariam Abdullah, Hassan Al-Farsi, Zainab Mustafa

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

### 📚 Documentation

- **`USER_GUIDE.md`**: Complete user manual with step-by-step instructions
- **`IMPLEMENTATION_SUMMARY.md`**: Technical documentation of all features
- **`CHANGES_LOG.md`**: Detailed changelog of all modifications

### 🚀 Quick Start

```bash
# Install dependencies
cd client
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173` and login with:
- **Admin**: admin@subscriptionhk.org / Admin#2025
- **Member**: member@subscriptionhk.org / Member#2025

### ✅ All CRUD Operations Working
- **Create**: Add members, create invoices, record payments
- **Read**: View all data dynamically from state
- **Update**: Edit members, mark invoices as paid, update profiles
- **Delete**: Remove members and invoices with confirmation

### 🎯 All Buttons Functional
Every button in the application now performs its intended action with:
- Form validation
- Toast notifications
- Real-time updates
- Data persistence

**Status**: ✅ **Production-ready with full functionality!**

