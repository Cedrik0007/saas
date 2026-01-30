# Payments QA Audit – Test Failure and Edge Scenarios

**Role:** Payments QA auditor  
**Scope:** Duplicate payment attempts, payment/invoice consistency, page refresh, year-boundary renewal, role-based permissions, member deactivation.  
**Verification:** No duplicate financial records, no lost/stuck payments, audit-safe invoice history, correct UI recovery.

---

## 1. Duplicate payment attempts

**Result: FAIL** (mitigated: no new Pending for already-paid invoice)

- **Create multiple Pending payments for same invoice:**  
  `POST /api/payments` **now** rejects with 400 if the referenced invoice is already Paid or Completed (“Cannot create payment for an invoice that is already paid.”).   So **no new** Pending payment can be created for an already-paid invoice. Existing duplicate Pending records (if any) remain until cleaned up.

- **Approval path – “invoice already paid”:**
  Both `approveInvoicePayment` and `approvePaymentAndMarkInvoicePaid` check at the **start** of the transaction: `if (invoice.status === "Paid" || invoice.status === "Completed")` → throw. So a **second approval** for the same invoice is rejected and no second Completed payment is created from that path. **But:**  
  - Multiple **Pending** payments for the same invoice can still exist (created via `POST /payments`).  
  - Under **concurrent** double-submit (two “Mark as paid” requests in flight), both can pass the “invoice not paid” check before either commits; both can then create a payment and update the invoice. That can result in **two Completed payments** for one invoice (race).

- **No idempotency:**  
  There is no idempotency key or idempotent handling on `POST /approve-invoice` or `PUT /:id/approve`. Duplicate submissions (double-click, refresh + resubmit, second tab) are not deduplicated.

- **Where:**  
  - `server/routes/payments.js`: `POST /` (no invoice status check).  
  - `server/services/paymentApprovalService.js`: “invoice already paid” check; no unique constraint or idempotency.

- **Recommendation:**  
  1) ~~In `POST /payments`, reject with 400 if `invoiceRecord.status` is Paid/Completed.~~ **Done:** `POST /payments` now rejects when invoice is already Paid/Completed.  
  2) Consider idempotency key (e.g. client-generated) for approve-invoice and reject duplicates.  
  3) Optional: unique index or application rule “at most one Completed payment per invoice” and handle conflict.

---

## 2. Payment success but invoice update failure

**Result: PASS**

- **Approval in a single transaction:**  
  Both `approvePaymentAndMarkInvoicePaid` and `approveInvoicePayment` run inside `session.withTransaction()`. The flow: load/validate payment and invoice, create/update payment, update invoice status (and member balance in the first). If **any** step throws (including “Failed to update invoice during payment approval”), the transaction is aborted and nothing is committed.

- **No “payment saved, invoice not updated”:**  
  So we do **not** get a state where a payment is Completed but the invoice remains Unpaid. Either both payment and invoice update commit, or neither does. Audit trail stays consistent.

- **Where:**  
  `server/services/paymentApprovalService.js`: full approval flow inside `session.withTransaction()`; invoice update with `session`; throw on `!updatedInvoice`.

---

## 3. Page refresh during payment

**Result: PASS** (with note)

- **Server:**  
  If the user refreshes after clicking “Mark as paid” but before the response, the approve-invoice request may still complete on the server. One payment is created and the invoice is marked Paid in one transaction. No half-state.

- **Client:**  
  After refresh, the app reloads and fetches payments and invoices from the API. The user sees the updated invoice status and the new payment. No duplicate is created by the refresh itself; the only risk is **double submit before refresh** (see scenario 1).

- **Recovery:**  
  Modal state is lost (expected). No “stuck” payment: either the request completed (data correct after refetch) or it did not (user can retry). No special “recovery” state required beyond normal refetch.

- **Note:**  
  If the user double-clicks or submits from two tabs, duplicate approval can occur (see scenario 1). UI could add a “submitting” lock to reduce double-clicks.

---

## 4. Year-boundary renewal

**Result: PASS**

- **When it runs:**  
  `checkAndCreateNextYearInvoices()` (e.g. cron on Jan 1) only runs when `currentMonth === 0 && currentDate === 1`. So “year boundary” is explicitly Jan 1.

- **Duplicate next-year invoice:**  
  Before creating a next-year invoice, `createNextYearInvoice` checks for an existing invoice for that member and next year: `existingInvoice = await InvoiceModel.findOne({ ...buildInvoiceMemberMatch(member), period: { $regex: String(nextYear) }, status: { $ne: "Rejected" } })`. If one exists, it skips. So we do **not** create a second next-year invoice for the same member.

- **Member identity:**  
  Next-year logic uses `buildInvoiceMemberMatch(member)` (memberRef + memberNo + memberId/previousDisplayIds). For upgraded members (AM→LM), the map may contain both old and new display ids; lookup by current `member.id` and the “existing invoice” check by member match avoid creating two next-year invoices for the same person.

- **Where:**  
  `server/services/nextYearInvoiceService.js`: Jan 1 guard; `createNextYearInvoice` existing-invoice check; member match via `buildInvoiceMemberMatch`.

---

## 5. Role-based permission violations

**Result: FAIL** (backend only)

- **Backend:**  
  Payment routes (`POST /`, `POST /approve-invoice`, `PUT /:id/approve`, etc.) are mounted **without** auth or role middleware in `server.js`. Any caller that can reach the API can create payments and approve invoices. So a **Viewer** (or unauthenticated caller if no global auth) can perform payment approval by calling the API directly. **Role-based permission is not enforced on the server.**

- **Frontend:**  
  Invoices and Payments sections are restricted to `roles: ["Owner", "Finance Admin"]`. Viewers do not see these sections or the “Mark as paid” flow. So **UI** correctly restricts payment actions to finance roles.

- **Conclusion:**  
  Permission is enforced in the UI only. Direct API access can bypass role checks → **FAIL** for “role-based permission violations” from an audit perspective.

- **Recommendation:**  
  Add auth middleware to payment routes and enforce “Owner” or “Finance Admin” for `POST /approve-invoice` and `PUT /:id/approve` (and optionally for `POST /` and `DELETE /:id`).

---

## 6. Member deactivation with invoice history

**Result: PASS**

- **Deactivation:**  
  Members can be set to `status: "Archived"`. Archived members are excluded from default member list (`status: { $ne: "Archived" }`); they cannot be approved or upgraded; PUT update is blocked (“Archived members are read-only”).

- **Invoice and payment history:**  
  Invoices and payments are linked by `memberRef` (ObjectId) and/or `memberId` (display id). There is **no** logic that deletes or alters historical invoices or payments when a member is archived. So **invoice and payment history remain intact** and audit-safe.

- **Audit:**  
  Past payments and invoices for an archived member remain queryable (e.g. by memberRef or memberId/previousDisplayIds). No lost or rewritten history.

- **Where:**  
  `server/routes/members.js`: archive behavior; no cascade on invoices/payments. Invoice and payment models keep `memberRef` / `memberId`.

---

## Verification summary

| Requirement | Status | Notes |
|-------------|--------|--------|
| No duplicate financial records | **FAIL** | Multiple Pending payments per invoice allowed; race can create two Completed payments for one invoice. |
| No lost or stuck payments | **PASS** | Approval is transactional; refresh does not lose payment. Orphan Pending payments possible (data quality), not “stuck” in a half-state. |
| Audit-safe invoice history | **PASS** | Invoice status and payment are updated atomically; history preserved on archive; no deletion of history. |
| Correct UI recovery states | **PASS** | Refresh recovers via refetch; modal state loss is expected; no stuck “submitting” without server state fix. |

---

## Summary table (scenarios)

| # | Scenario | Result | Where / why |
|---|----------|--------|-------------|
| 1 | Duplicate payment attempts | **FAIL** | POST /payments allows new Pending for Paid invoice; no idempotency; race can create two Completed payments. |
| 2 | Payment success but invoice update failure | **PASS** | Full flow in transaction; rollback on invoice update failure. |
| 3 | Page refresh during payment | **PASS** | Server commits once; client recovers by refetch. |
| 4 | Year-boundary renewal | **PASS** | Jan 1 only; existing-invoice check prevents duplicate next-year invoice. |
| 5 | Role-based permission violations | **FAIL** | Backend does not enforce role; Viewer can call approve via API. |
| 6 | Member deactivation with invoice history | **PASS** | History preserved; no cascade delete or rewrite. |

---

## Financial risk level: **MEDIUM**

- **LOW** would require: no duplicate payment records (including Pending), server-side role enforcement, and idempotent approval.
- **Current:**  
  - **Duplicate records:** Possible (multiple Pending per invoice; two Completed per invoice under race).  
  - **Consistency:** Good (payment + invoice in one transaction; no “payment saved, invoice not updated”).  
  - **Audit trail:** Good (history kept; year-boundary and archive behavior correct).  
  - **Permissions:** Weak at API level (role not enforced on payments).  
- **Conclusion:** Financial risk is **MEDIUM**: money is not “lost” or double-counted in the core path (one approval = one payment + invoice update), but duplicate records and missing API-level role checks create audit and control risk. Implementing the recommendations above would move risk toward **LOW**.

---

*Audit based on: `server/routes/payments.js`, `server/services/paymentApprovalService.js`, `server/services/nextYearInvoiceService.js`, `server/models/Payment.js`, `server/models/Invoice.js`, `server/routes/members.js`, `server/server.js`, and client `AdminPage.jsx` (payment modal and nav roles).*
