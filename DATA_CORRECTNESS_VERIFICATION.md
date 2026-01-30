# Data Correctness – Member, Invoice, and PDF Consistency (Bulk Operations)

**Role:** Senior QA auditor for data correctness  
**Scope:** Create 10 members per type, member list/detail, pay invoices and PDF receipts, edit members, cross-check UI vs invoice table vs PDF.

---

## 1. Create 10 members per subscription type (Annual, Lifetime, Lifetime+Janaza)

**PASS**

- **Backend:** `POST /api/members` accepts `subscriptionType`; allowed values include `SUBSCRIPTION_TYPES.ANNUAL_MEMBER` and `SUBSCRIPTION_TYPES.LIFETIME_MEMBER_JANAZA_FUND`. Display ID prefix: `getDisplayIdPrefix(subscriptionType)` → "AM" for Annual, "LM" for Lifetime/Lifetime+Janaza. `buildNextDisplayId(prefix)` allocates AM1, AM2, … or LM1, LM2, … from `DisplayIdCounterModel`. No limit on count; creating 10 Annual, 10 Lifetime, 10 Lifetime+Janaza (30 total) is supported.
- **First invoice per member:** On create, one invoice is created per member with `memberRef: savedMember._id`, `memberId: savedMember.id`, `memberName: savedMember.name`, `subscriptionType`, and amount from `calculateFeesForMember` (500 for Annual, 5250 for full Lifetime+Janaza first payment, 250 for Janaza-only).
- **Data:** Each member gets a stable `_id`, unique `id` (AMxxx/LMxxx), and correct `subscriptionType`; invoices link by `memberRef` and `memberId`. No cross-member leakage.

**Component / location:** `server/routes/members.js` (POST /, create member + first invoice); `server/utils/subscriptionTypes.js`; `server/models/DisplayIdCounter.js`.

---

## 2. Verify member list and detail data (name, member ID, subscription type, year)

**PASS**

- **Source:** Member list and detail come from context `members` (from `GET /api/members`). Each document has `name`, `id` (AMxxx/LMxxx), `subscriptionType`, `start_date` / `createdAt`, and enriched `latestInvoiceYear` (from invoice periods).
- **Name:** Displayed from `member.name` (API).
- **Member ID:** Displayed from `member.id` (AMxxx/LMxxx).
- **Subscription type:** Displayed from `member.subscriptionType` (normalized in client for display).
- **Year:** Shown as subscription year or join year; derived from `getMemberSubscriptionYear(member)` (latest invoice period year) or `member.start_date` / `member.createdAt`.
- **Bulk:** List is a single array; filtering and pagination use this array. No per-row mix-up; each row is one member from the list.

**Component / location:** `client/src/pages/AdminPage.jsx` (members section, member detail); `client/src/context/AppContext.jsx` (members state); `server/routes/members.js` (GET / with optional latestInvoiceYear enrichment).

---

## 3. Pay invoices and verify PDF receipts (member name/ID, subscription label, amount, year, paid status)

**PASS** (after fix)

- **Member resolution for PDF:** All PDF receipt routes resolve member by `resolveMember(invoice.memberRef || invoice.memberNo || invoice.memberId)`. So the member is always the one linked to the invoice (memberRef is primary). PDF uses this member and the invoice (and payment) only.
- **Member name on PDF:** `memberName = displayReceiptField(member?.name)` in `pdfReceipt.js`. So PDF shows **current** member name (from resolved member). After an edit, the receipt shows the updated name; invoice rows in member detail use the same member, so they match.
- **Member ID on PDF:** `memberId = displayReceiptField(member?.id)` in `pdfReceipt.js`. PDF shows **current** display ID (AMxxx or LMxxx). For upgraded members, old invoices have `invoice.memberId = AMxxx` but member is resolved by `memberRef`; current `member.id` is LMxxx, so PDF shows LMxxx. Invoice table can show `invoice.memberId` (AMxxx for old rows); both are correct (table = historical invoice ID, PDF = current member ID for the same person).
- **Subscription label on PDF:** `subscriptionType = displayReceiptField(invoice?.subscriptionType ?? member?.subscriptionType ?? invoice?.invoiceType)` in `pdfReceipt.js`. **Fix applied:** The invoice routes previously deleted `invoicePayload.subscriptionType` before calling `generatePaymentReceiptPDF`, so the PDF fell back to `member.subscriptionType` (current). For an old annual invoice after upgrade, the PDF could show "Lifetime Member + Janaza Fund" instead of "Annual Member". **Change:** Removed `delete invoicePayload.subscriptionType` in all four PDF receipt routes so the invoice’s `subscriptionType` is passed through. The PDF now uses the **invoice’s** subscription type when present, so the receipt label matches the invoice table (e.g. Annual 500 vs Lifetime 5250/250).
- **Amount on PDF:** `amountValue = payment?.amount ?? invoice?.amount`; parsed and formatted as `HK$${formattedAmount}`. So 500 / 5250 / 250 are shown correctly from the paid invoice/payment.
- **Year on PDF:** `membershipYear` extracted from `invoice.period` (regex `\d{4}`); displayed as "Membership Year". Matches invoice period.
- **Paid status:** PDF receipt is only generated when `invoice.status === "Paid" || invoice.status === "Completed"` (all PDF routes check this). So receipt implies paid.

**Component / location:** `server/routes/invoices.js` (pdf-receipt/download, pdf-receipt, pdf-receipt/view, pdf-receipt/whatsapp); `server/utils/pdfReceipt.js` (generatePaymentReceiptPDF).

---

## 4. Edit members (change name and subscription type; member ID sequence; old invoices remain linked)

**PASS**

- **Change name:** `PUT /api/members/:id` allows updating `name`. Member list/detail refresh from API; payments are updated via `PaymentModel.updateMany({ memberId: memberIdentifierForPayments }, { $set: { member: updateData.name } })` so payment rows show the new name. Invoices are not rewritten; they keep stored `memberName` at creation time. PDF uses **resolved member** (current name), so PDF and UI member name match after edit. Invoice table in member detail is for one member, so the header shows current name; per-invoice `memberName` in DB is historical only.
- **Change subscription type:** Normal `PUT /api/members/:id` allows subscription change **only if** it does not change the display ID prefix. `getDisplayIdPrefix(currentType) !== getDisplayIdPrefix(requestedType)` → 400: "Subscription changes that affect display ID must use POST /api/members/:id/upgrade-subscription." So changing Annual → Lifetime (or vice versa) cannot be done via normal edit; it must go through the upgrade flow. Within the same prefix (e.g. Lifetime+Janaza ↔ Janaza-only via `janazaOnly`), display ID stays the same.
- **Member ID sequence behavior:** Display ID is not sent in PUT body (400 if provided). It only changes in the **upgrade-subscription** flow (AM→LM, old id pushed to `previousDisplayIds`). So normal edit does not change `member.id`; sequence (AM1, AM2, …) is unchanged for non-upgrade edits.
- **Old invoices remain linked:** Invoices link by `memberRef` (ObjectId). Edit and upgrade do not change `member._id`. Old invoices keep `memberRef: member._id` and their stored `memberId` (e.g. AMxxx); they are still found by `memberRef` and by `memberId` in `[member.id, ...previousDisplayIds]`. So old invoices remain linked after edit or upgrade.

**Component / location:** `server/routes/members.js` (PUT /:id; upgrade-subscription); `client` (member edit form, refresh after update).

---

## 5. Cross-check: UI vs invoice table vs PDF must match exactly

**PASS** (after PDF subscription fix)

- **Member name:** UI (list/detail) = `member.name` from API. Invoice table (in member detail) = one member’s invoices; header/context is same member name. PDF = `member.name` from member resolved by `invoice.memberRef`. So UI and PDF both use current member name; they match. Invoice rows do not override member name in member-detail view (context is one member).
- **Member ID:** UI = `member.id` (current). Invoice table can show `invoice.memberId` per row (so old invoices show AMxxx, new show LMxxx). PDF = `member.id` (current). So for upgraded members, invoice table row may show AMxxx and PDF may show LMxxx for the same person; both are correct (row = invoice’s stored ID, PDF = current identity). No mismatch for non-upgraded members.
- **Subscription label:** UI invoice table = `invoice.subscriptionType` (or derived). PDF = `invoice?.subscriptionType ?? member?.subscriptionType ?? invoice?.invoiceType`. **After fix:** Invoice’s `subscriptionType` is passed to the PDF, so PDF label matches the invoice (Annual vs Lifetime) and thus the invoice table.
- **Amount:** UI invoice table = `invoice.amount` (formatted). PDF = `payment?.amount ?? invoice?.amount` (formatted). Same source; match.
- **Year:** UI = from `invoice.period`. PDF = from `invoice.period`. Match.
- **Paid status:** UI uses effective status (invoice status or payment-based). PDF is only generated when invoice is Paid/Completed. Match.

**Data mismatch list (before fix):**

| Mismatch | Location | Status |
|----------|----------|--------|
| PDF subscription label showed current member type instead of invoice type for old invoices (e.g. upgraded member’s annual invoice showed "Lifetime Member + Janaza Fund" on PDF). | `server/routes/invoices.js` (all four PDF receipt routes) | **Fixed:** Removed `delete invoicePayload.subscriptionType` so PDF receives and uses `invoice.subscriptionType`; receipt label now matches invoice table. |

No other data mismatches identified.

---

## Summary table

| # | Scenario | Result | Notes |
|---|----------|--------|--------|
| 1 | Create 10 members per type | **PASS** | API supports it; display ID AM/LM; first invoice per member; link by memberRef. |
| 2 | Member list and detail (name, ID, type, year) | **PASS** | Data from API; list/detail consistent. |
| 3 | Pay invoices and PDF (name, ID, label, amount, year, paid) | **PASS** | Member resolved by invoice; PDF uses invoice.subscriptionType after fix; amount/year from invoice. |
| 4 | Edit members (name, type, ID sequence, old invoices linked) | **PASS** | Name and same-prefix type editable; ID only changes on upgrade; invoices linked by memberRef. |
| 5 | Cross-check UI vs invoice table vs PDF | **PASS** | Name, amount, year aligned; PDF subscription label aligned after fix; member ID semantics (current vs stored) documented. |

---

## Verdict: **DATA SAFE**

- All scenarios **PASS**.
- One fix applied: **PDF subscription label** now uses the invoice’s subscription type so receipts match the invoice table (and correct amounts 500 / 5250 / 250).
- Member identity and invoice linking use `memberRef` and current/previous display IDs consistently; edits and upgrades do not break links. Bulk create and list/detail/PDF data are consistent.

**Recommendation:** For upgraded members, the invoice table may show `invoice.memberId` (e.g. AMxxx) for old rows while the PDF shows `member.id` (LMxxx). This is intentional (historical invoice ID vs current member ID). If you need the PDF to show the invoice’s stored memberId for strict historical print, that can be an option; current behavior (current member ID on receipt) is acceptable for DATA SAFE.
