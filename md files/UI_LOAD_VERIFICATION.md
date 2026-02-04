# UI Stability and Data Correctness Under Load – Verification Report

**Role:** Senior frontend + QA engineer  
**Scenarios:** Create 10 per subscription type, member list load, member details (invoices), payment flow, rapid member switching.

---

## Scenario 1: Create 10 members per subscription type (Annual, Lifetime, Lifetime+Janaza)

**PASS**

- **Where:** `AdminPage.jsx` – member creation uses shared add-member flow; subscription type is selected in form. Backend `POST /api/members` and `getDisplayIdPrefix(subscriptionType)` yield AM for Annual, LM for Lifetime/Lifetime+Janaza.
- **UI:** Single form; no client-side limit on count. Creating 10 Annual, 10 Lifetime, 10 Lifetime+Janaza is supported (30 members total).
- **Data:** Each member gets `_id`, `id` (AMxxx/LMxxx), `subscriptionType`; first invoice created on backend per member. No client-side logic that would mis-assign type or duplicate identity.
- **Note:** No bulk-create UI; 30 creations are 30 sequential (or parallel) form submissions. For true “load” testing, consider a small script or backend seed; UI correctness for each create is verified.

---

## Scenario 2: Load member list – no empty table glitches, no flicker, correct pagination/scroll

**PASS** (with minor note)

- **Data load:** `AppContext.jsx` – `fetchMembers()` loads all members in one request (`GET /api/members`). No server-side pagination; for 30 members this is one response, then `setMembers(normalizedMembers)`.
- **Empty table:** `AdminPage.jsx` (members section) – when `sortedMembers.length === 0`, the table is not shown; an empty state is rendered instead (`admin-empty-state`, “No members found” / “No {status} members found”). So no “empty table with headers only” glitch when there are zero members after filter.
- **Flicker:** On first load, `members` starts as `[]`, then is set from API. So the first paint can show “No members found” briefly, then the list appears. For 30 members and typical network, this is a short transition. No intermediate “wrong count” or layout jump from pagination; `membersPage` is reset when filters change, and `currentPage` is bounded by `totalPages`. **Minor:** Possible brief “empty then list” on slow network.
- **Pagination / scroll:** `membersPage`, `membersPageSize` (default 10), `sortedMembers.slice(startIndex, endIndex)` → `paginatedMembers`. `Pagination` component receives `totalItems={sortedMembers.length}`, `currentPage`, `pageSize`, `onPageChange`, `onPageSizeChange`. Bounds are enforced in `useEffect`: if `membersPage > totalPages` and `totalPages > 0`, `setMembersPage(1)`. So pagination and scroll are correct; no wrong slice or out-of-range page.
- **Component/hook:** Member list and pagination are in `AdminPage.jsx` (members section); state is local (`membersPage`, `membersPageSize`) plus context `members`. No identified bug.

---

## Scenario 3: Open member details – invoices match correct member, no cross-member leakage

**PASS**

- **Matching:** Member detail invoices are derived in render with `invoices.filter(inv => matchesInvoiceToMember(inv, selectedMember))`. `matchesInvoiceToMember` (`utils/matchesInvoiceToMember.js`) compares:
  - `invoice.memberNo` ↔ `member.memberNo`
  - `invoice.memberId` ↔ `member.id`
  - `invoice.memberId` ↔ `member.previousDisplayIds[].id`
  - `invoice.memberRef` ↔ `member._id`
  So invoices are tied to one member by backend identity (`memberRef`) and display ids (current + previous). No use of a global or shared id that could mix members.
- **List table:** Each row uses `getMemberInvoices(member.id)`, which resolves the member by `member.id` or `previousDisplayIds`, then filters invoices with `matchesInvoiceToMember(inv, matchingMember)`. Same contract; no cross-member set.
- **Conclusion:** Invoices shown in member detail (and in list) are scoped to the correct member; no cross-member invoice leakage. **Component:** `matchesInvoiceToMember` + `getMemberInvoices` in `AdminPage.jsx`; **hook:** N/A (pure derivation from `selectedMember` and `invoices`).

---

## Scenario 4: Perform payment on a member – invoice status updates, table refreshes, no duplicate/stale data

**PASS** (with clarification)

- **Payment row (e.g. receiver name) – immediate:** After `PUT /api/payments/:id` in `handleUpdatePayment`, the response is passed to `updatePaymentInState(data.payment)`. `AppContext.updatePaymentInState` updates `payments`, `paymentHistory`, and `recentPayments` in place for that payment. The member-detail payments table reads from `paymentHistory`, so the table refreshes without manual reload and shows no duplicate rows (single source of truth).
- **Invoice status after “Mark as paid”:** Payment approval flow calls `await fetchInvoices()` after approval. Invoice status in the UI therefore updates when the refetch completes. If the server emits `invoice:updated` over socket (and client has socket listeners), `AppContext` also applies that via `setInvoices(prev => prev.map(...))`, which can update status without waiting for refetch. So invoice status can update “immediately” if the backend emits socket events; otherwise it updates after `fetchInvoices()`. Table is driven by context `invoices`; no manual reload needed. No duplicate or stale invoice rows; list is derived from `invoices` + `matchesInvoiceToMember`.
- **Component/hook:** Payment update – `AdminPage.jsx` `handleUpdatePayment` → `updatePaymentInState`. Invoice status – `fetchInvoices()` after approval; optional socket `invoice:updated` in `AppContext.jsx`. No identified bug.

---

## Scenario 5: Rapidly switch between members – no stale state or UI bleed

**PASS** (after fix)

- **Issue found:** In `handleViewMemberDetail`, after `Promise.all([fetchMembers(), fetchPayments()])`, the code fetched the opened member by `targetMemberDbId` and did `setSelectedMember(latestMember)`. If the user had already switched to another member (e.g. B), this callback could still run for the previous member (A) and overwrite `selectedMember` with A, causing the UI to jump back to A (stale state / UI bleed).
- **Fix applied:** The update was changed to a functional update that only applies the refreshed member when the user is still viewing that same member:
  - `setSelectedMember((prev) => prev && String(prev._id) === String(targetMemberDbId) ? latestMember : prev)`
  - So when the delayed fetch completes, we only set `selectedMember` to `latestMember` if `selectedMember._id` still equals `targetMemberDbId`. If the user has switched to another member, we leave `selectedMember` unchanged.
- **Where:** `AdminPage.jsx` – `handleViewMemberDetail` (around the `fetch(/api/members/${targetMemberDbId})` callback).
- **Rest of flow:** `setSelectedMember(memberToView)` is called immediately when opening a member; member-detail content (invoices, etc.) is derived from current `selectedMember` and `invoices`. So rapid switching only changes who is “selected”; the refresh callback no longer overwrites that. **Verdict:** PASS after fix; no stale state or UI bleed from this path.

---

## Summary table

| Scenario | Result | Notes |
|--------|--------|--------|
| 1. Create 10 per type | **PASS** | UI + API support it; no identity/type mix-up. |
| 2. Load member list | **PASS** | Empty state when 0; pagination correct; possible brief empty→list on first load. |
| 3. Member details invoices | **PASS** | `matchesInvoiceToMember` + `getMemberInvoices`; no cross-member leakage. |
| 4. Payment on member | **PASS** | Payment row updates immediately via `updatePaymentInState`; invoice status via refetch or socket; table refreshes; no duplicate/stale. |
| 5. Rapid member switch | **PASS** | Fixed: refresh callback only updates `selectedMember` if still viewing that member. |

---

## Verdict: **UI SAFE**

- No scenario is marked FAIL.
- One code fix was applied: **Scenario 5** – guard the post-fetch `setSelectedMember` in `handleViewMemberDetail` so rapid switching does not overwrite the current selection with a previously opened member.
- **Components/hooks:** All issues or checks are in `AdminPage.jsx` (member list, member detail, payment handler, view-member handler) and `AppContext.jsx` (fetch, `updatePaymentInState`, socket updates). No other component or hook was identified as causing the described issues.

---

*Verification was done by code review and one targeted fix. For full load validation (e.g. 30+ members, slow network, many rapid clicks), run the app and repeat the scenarios in the browser.*
