## Subscription Manager HK – Screen Flow & UI Spec

Light-mode SaaS dashboard for Hong Kong membership dues. Currency symbol `$`, desktop-first with responsive variants down to 480 px. Primary palette: white surfaces, cool gray cards, indigo primary `#3B5BDB`, teal accent `#2F9E44`, semantic badges (green paid, amber pending, red overdue, gray inactive). Typography: Inter/SF Pro 16 px base, 20 px/24 px headings, compact table text.

---

### 1. Public / Entry
**Login Screen**
- Split hero (left branding panel, right form).
- Logo text “Subscription Manager HK”, tagline “Manage recurring contributions effortlessly”.
- Form: Email, Password (show/hide), buttons `Login as Admin`, `Login as Member`, link `Forgot password?`.
- Light illustration of HK skyline; on mobile stack vertically.

---

### 2. Admin Experience
Persistent sidebar nav: Dashboard · Members · Invoices · Reminders & Automation · Payments & Methods · Reports · Settings. Top app bar with search, notifications, avatar.

#### 2.a Dashboard
- KPI cards (Total Members 312, Total Collected toggle month/year `$12,450 / $220,800`, Outstanding `$18,400`, Overdue Members 27).
- Chart: 12-month column + expected line (Oct 2024–Sep 2025).
- Table `Recent Payments`:
  | Member | Period | Amount | Method | Status | Date |
  | Samuel Chan | Oct 2025 | $50 | FPS | Paid | 05 Oct 10:22 |
  | Janice Leung | Oct 2025 | $50 | PayMe | Paid | 02 Oct 09:11 |
  | Omar Rahman | Sep 2025 | $100 | Credit Card | Overdue | 20 Sep 14:10 |
- Right rail card “Reminders sent this week (24)”.

#### 2.b Members List
- Filters: Status (All/Active/Inactive), Payment Status (All/Paid/Unpaid/Overdue), search box.
- Bulk actions on selection: `Send Reminder`, `Export`.
- Table columns: Member ID, Name, Email, WhatsApp phone, Status badge, Current Balance (e.g., `$150 Outstanding`), Next Due Date, Last Payment Date.

#### 2.c Member Detail
- Header: avatar initials, Member Name (e.g., Samuel Chan), ID HK1021, email, WhatsApp link, actions `Create Invoice`, `Send Reminder`.
- Summary cards: Total Paid This Year `$650`, Outstanding `$150`, Next Due `05 Nov 2025`, Plan `$50/mo + 2×$100 Eid`.
- Tabs:
  1. **Invoices** table (Invoice #, Period, Amount, Status, Due Date, Method, Reference) with CTAs `Create Manual Invoice`, `Mark as Paid`.
  2. **Payment History** timeline entries “05 Oct 2025 · $50 · FPS · Ref FP89231 · Paid”.
  3. **Communication** log (channel icon, date, Delivered/Pending).

#### 2.d Invoice Creation / Edit
- Form fields: Member dropdown, Invoice Type segmented buttons (Monthly/Eid), Period picker, Amount auto ($50 / $100 overrideable), Due Date picker, Notes textarea.
- Buttons: primary `Save`, secondary accent `Save & Send Reminder`.

#### 2.e Reminders & Automation
- Toggle `Enable automatic reminders`.
- Schedule rows: “3 days before due date”, “On due date”, “5 days after” each with Email/WhatsApp checkboxes.
- Message Templates accordion for Upcoming Due + Overdue reminders (editable text, preview tabs Email/WhatsApp).
- Integration cards for WhatsApp API + Email SMTP (status: Connected / Not Connected, `Manage` buttons).

#### 2.f Payments & Methods
- Cards per method with visibility toggles:
  - Direct Bank Transfer (Bank Name, Account No, Account Holder).
  - FPS (FPS ID).
  - Alipay / PayMe (QR placeholder upload, instructions).
  - Credit/Debit Cards (gateway dropdown, API keys, webhook URL).
- Show last updated timestamp and `Test connection`.

#### 2.g Reports
- Date range picker + quick chips (This Month, Quarter, Year).
- KPI: “Collected $220,800 vs Expected $249,600 (88%)”.
- Charts: donut for payment method mix, stacked bar for collected vs outstanding by month.
- Buttons `Export CSV`, `Export PDF`.

#### 2.h Settings
- Organization info form (name, contact, address, logo upload).
- User management table (Admin name, role, status toggle, `Remove`, `Add Admin` button).
- Notification preferences toggles (System alerts, Weekly digest, Reminder escalations).

---

### 3. Member Experience
Top nav tabs: Dashboard · Invoices · Payments · Avatar menu. Mobile: collapsible menu.

#### 3.a Member Dashboard
- Welcome header “Hi Aisha 👋”.
- Card `Current Status`: Next Due Amount ($50 or Eid $100), Next Due Date, Outstanding Balance total, status badge `Paid / Unpaid / Overdue`. Primary `Pay Now`.
- Upcoming Payments list (Month/Eid, Due Date, Amount, Status).
- Shortcut tiles: `View Invoices`, `Payment History`, `Update Contact Details`.

#### 3.b Pay Now
- Summary of due items (Nov Monthly $50, Eid 2 $100) with total.
- Payment method tabs:
  - Bank Transfer / FPS / Alipay / PayMe: instructions (account no, FPS ID, QR), inputs `Transaction Reference`, `Upload Payment Proof`, CTA `Submit Payment Details`.
  - Credit/Debit Card: fields Card Number, Name on Card, Expiry, CVV, CTA `Pay $150`.
- Confirmation states: “Payment Submitted – awaiting verification” for manual, “Payment Successful” for card.

#### 3.c Member Invoices
- Table/list: Invoice No, Period, Amount, Status badge, Due Date, `View`.
- Detail modal/page: invoice breakdown, PDF download, `Pay Now` if unpaid.

#### 3.d Payment History
- Timeline list with Date, Amount, Method, Status, Reference (e.g., “05 Oct 2025 · $50 · FPS · Paid · Ref FP89231”).

#### 3.e Profile & Notification Preferences
- Fields: Name, Email, Mobile (WhatsApp).
- Toggles: Receive email reminders, Receive WhatsApp reminders.

---

### 4. Illustrated User Flows
1. Admin login → Dashboard → Members → Member Detail → Create Invoice → Save & Send Reminder (toast “Reminder sent via Email + WhatsApp”).
2. Admin login → Reminders & Automation → Enable automatic reminders → configure before/on/after schedules → save.
3. Member login → Dashboard → Pay Now → choose PayMe → upload proof → confirmation.
4. Member login → Dashboard → View Invoices → open invoice → Pay Now (card) → success screen.

---

### Sample Data References
- Members: Samuel Chan (HK1021), Janice Leung (HK1088), Omar Rahman (HK1104), Aisha Malik (HK1112).
- Dues: $50 monthly, two Eid dues $100 (April & September), annual expected $800.
- Payment methods: Direct Bank Transfer, FPS, Alipay, PayMe, Credit Card, Debit Card.
- Status tags: `Paid`, `Unpaid`, `Overdue`, `Pending Verification`.






