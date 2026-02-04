# Annual → Lifetime + Janaza Conversion – Verification Report

**Context:**  
- `internal_member_id` = MongoDB `_id` (primary identity, must never change)  
- `ui_member_code` = display id (`member.id`: AMxxx, LMxxx)  
- `previousDisplayIds` = array of `{ id, subscriptionType, changedAt }` for old display ids  

**Subscription model:** Annual = 500/year, Lifetime = 5000 one-time, Janaza = 250/year add-on.

---

## Test steps: PASS/FAIL

### 1. Create a new Annual Member – capture internal_member_id and ui_member_code (AMxxx)

**PASS**

- **Where:** `server/routes/members.js` POST `/` (create member).
- **internal_member_id:** Set by MongoDB on `new UserModel(...).save()` → `savedMember._id` (ObjectId). Never set from request.
- **ui_member_code:** For Annual, `getDisplayIdPrefix(subscriptionType)` returns `"AM"` (`subscriptionTypes.js`: Annual → "AM", else "LM"). If client does not send `id`, `memberId = await buildNextDisplayId(prefix, ...)` → `AM` + seq from `DisplayIdCounterModel` → **AMxxx**. Stored in `member.id`.
- **Conclusion:** New Annual member gets `_id` (internal) and `id` = AMxxx (display). Correct.

---

### 2. Verify invoices: exactly 1 invoice, amount = 500

**PASS**

- **Where:** Same POST `/` in `members.js` (lines 716–818).
- **Count:** After `savedMember` exists, code checks for an existing invoice by `memberRef` / `memberNo` / `memberId` and **period**; only if `!existingInvoice` does it create one. For a new member there is no existing invoice → **exactly one** invoice is created.
- **Amount:** `fees = calculateFeesForMember({ subscriptionType, lifetimeMembershipPaid, janazaOnly })`. For Annual Member, `subscriptionTypes.js` `getSubscriptionConfig("Annual Member")` returns `membershipFee: 500`, `janazaFee: 0`, `totalFee: 500`. Invoice `amount: \`HK$${fees.totalFee}\`` → **500**.
- **Conclusion:** Exactly one invoice, amount 500. Correct.

---

### 3. Upgrade the SAME member to Lifetime + Janaza – identity and display id

**PASS**

- **Where:** `server/routes/members.js` POST `/:id/upgrade-subscription`.
- **API input:** `req.params.id` must be a valid Mongo ObjectId (`Types.ObjectId.isValid(memberObjectId)`); body must not send `memberNo` or `id`. So upgrade is keyed by **internal_member_id** only.
- **Same document:** `member = await UserModel.findById(memberObjectId).session(session)` then `member.subscriptionType = requestedType`, `member.id = newDisplayId`, `member.previousDisplayIds = [...], previousEntry]`, `await member.save({ session })`. No `new UserModel()`. **Same user document updated.**
- **internal_member_id:** Never reassigned; `member._id` unchanged.
- **ui_member_code:** `newDisplayId = await buildNextDisplayId("LM", { session })` → LMxxx. `member.id = newDisplayId` → **changes from AMxxx to LMxxx**.
- **previousDisplayIds:** `oldDisplayId = member.id` (AMxxx) before change; `previousEntry = buildPreviousDisplayIdEntry(member, oldDisplayId)` → `{ id: normalized, subscriptionType, changedAt }`. Pushed with `member.previousDisplayIds = [...(existing), previousEntry]`. **Old AMxxx stored in previousDisplayIds.**
- **Conclusion:** internal_member_id unchanged, ui_member_code AMxxx → LMxxx, old AMxxx in previousDisplayIds. Correct.

---

### 4. Verify invoices after upgrade: old 500, one new 5250, total 2

**PASS**

- **Where:** Upgrade handler in `members.js` (lines 328–411); invoice list in `invoices.js` GET `/member/:memberId`.
- **Old invoices:** Upgrade flow does not modify or delete existing invoices. Old Annual invoice (500) remains, still `memberRef: member._id`, `memberId: AMxxx`.
- **New invoice:** One upgrade invoice created in same transaction: `existingUpgradeInvoice` check by `memberRef`, `period`, `invoiceType`; if none, create **one** invoice with `calculateFeesForMember({ subscriptionType: LIFETIME_MEMBER_JANAZA_FUND, lifetimeMembershipPaid: false, janazaOnly: false })` → `totalFee` = **5250**. Stored with `memberRef: member._id`, `memberId: member.id` (LMxxx).
- **Total count:** Before upgrade: 1 (500). After: 1 + 1 = **2** (500 + 5250).
- **Fetch:** GET `/invoices/member/:memberId` requires `:memberId` to be Mongo `_id`. It loads member by `UserModel.findById(memberId)`, then `validIds = [memberExists.id, ...previousDisplayIds[].id]` (LMxxx, AMxxx). `InvoiceModel.find({ memberId: { $in: validIds } })` returns both the old (memberId=AMxxx) and the new (memberId=LMxxx) invoice.
- **Conclusion:** Old 500 invoice exists; exactly one new 5250; total 2; fetch by internal_member_id returns both. Correct.

---

### 5. Trigger renewal for next year – only one new invoice, amount 250

**PASS**

- **Where:** `server/services/nextYearInvoiceService.js` (e.g. `checkAndCreateNextYearInvoices`), `server/utils/subscriptionTypes.js` (`calculateFeesForMember`), `server/services/paymentApprovalService.js` (sets `lifetimeMembershipPaid`).
- **After upgrade payment:** When the 5250 invoice is approved, `paymentApprovalService` sets `isLifetimeMembershipFullPayment` (Lifetime + Janaza, not yet lifetime paid, and invoice is lifetime_membership or amount ≥ 5000) and then `memberUpdate.lifetimeMembershipPaid = true`. So after paying the upgrade invoice, the member has **lifetimeMembershipPaid = true**.
- **Next-year renewal:** `createNextYearInvoice(member, ...)` uses `fees = calculateFeesForMember(member)`. In `subscriptionTypes.js`, for Lifetime Member + Janaza, if `lifetimeMembershipPaid` (or `janazaOnly`) is true, the config returns **only** `janazaFee: 250`, `totalFee: 250` (no 5000, no 500). So renewal creates **one** invoice with amount **250**.
- **Conclusion:** Next year renewal produces only one new invoice, amount 250; no 500 or 5000 charged again. Correct.

---

### 6. Identity safety checks

**PASS**

- **No new member document on upgrade:** Upgrade uses `UserModel.findById(memberObjectId)` then `member.save()`. No `new UserModel()` or `UserModel.create()`. **PASS.**
- **ui_member_code not primary key:** User primary key is MongoDB `_id` (default). `User` schema has `id` (display) with `unique: true, sparse: true`; it is a business identifier, not the document key. All internal linking (invoices, payments) uses `memberRef` (ObjectId). **PASS.**
- **All invoices link via internal_member_id (memberRef):**  
  - Create member: `memberRef: savedMember._id`.  
  - Upgrade: `memberRef: member._id`.  
  - Next-year: `memberRef: member._id`.  
  Invoice model has `memberRef: { type: mongoose.Schema.Types.ObjectId, ref: "users" }`. Resolvers use `invoice.memberRef || invoice.memberNo || invoice.memberId` with `memberRef` first. **PASS.**

---

## Summary

| Step | Result | Notes |
|------|--------|--------|
| 1. Create Annual Member | **PASS** | internal_member_id = `_id`, ui_member_code = AMxxx |
| 2. Invoices for new member | **PASS** | Exactly 1 invoice, amount 500 |
| 3. Upgrade same member | **PASS** | _id unchanged, id AM→LM, old AM in previousDisplayIds |
| 4. Invoices after upgrade | **PASS** | Old 500 + one 5250, total 2; fetch by _id returns both |
| 5. Next-year renewal | **PASS** | One new invoice, amount 250 only |
| 6. Identity safety | **PASS** | No new user on upgrade; _id is primary; invoices use memberRef |

---

## Verdict: **SAFE**

- Conversion uses **internal_member_id** (Mongo `_id`) only for the upgrade endpoint and does not create a new member.
- **ui_member_code** is used for display and for querying invoices by current + previous display ids; it is not used as primary key or as the sole link for invoices (memberRef is).
- **previousDisplayIds** is append-only on upgrade; old display ids are preserved for invoice and balance lookups.
- Subscription amounts (500 / 5000 / 250) and renewal behavior (250 only after lifetime paid) match the intended model in code and flow.

---

*Verified from code: `server/routes/members.js`, `server/routes/invoices.js`, `server/utils/subscriptionTypes.js`, `server/services/nextYearInvoiceService.js`, `server/services/paymentApprovalService.js`, `server/models/User.js`, `server/models/Invoice.js`, `server/utils/balance.js`.*
