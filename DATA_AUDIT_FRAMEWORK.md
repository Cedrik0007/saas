# Data Audit Framework – Root Cause Classification

## Overview

Before applying fixes or bulk actions, classify each issue as one of:

| Classification | Meaning |
|----------------|---------|
| **DATA ISSUE** | Bad or inconsistent data; system rules are correct |
| **DUPLICATE MEMBER ATTEMPT** | User tried to add a member that already exists |
| **EXPECTED SYSTEM BLOCK** | System correctly prevented an invalid action |
| **LEGIT BUG** | System violates defined business rules |

---

## Checks Performed (by Audit Script)

### 1. Member existence / duplicate member ID

- Searches for multiple members sharing the same `id`
- **Root cause**: Same ID used by more than one record
- **Action**: Merge or correct; ensure unique member IDs

### 2. Duplicate phone numbers

- Searches for multiple members with the same phone number
- **Root cause**: Same phone used by multiple members
- **Action**: Correct or merge; ensure unique phone numbers

### 3. Missing phone number

- Members with no phone number
- **Root cause**: Incomplete member data
- **Action**: Add valid phone for WhatsApp/receipt delivery

### 4. Invoices referencing non-existent members

- Invoices whose `memberId` does not exist in members
- **Root cause**: Orphan invoice or member removed
- **Action**: Link invoice to existing member or create missing member

### 5. Duplicate invoices (same member + period)

- Multiple non-archived invoices for same member and period
- **Root cause**: Duplicate creation
- **Action**: Archive or merge duplicates; keep single canonical invoice

### 6. Paid invoices missing receiptNumber

- `status = Paid` but `receiptNumber` is null, empty, or invalid
- **Root cause**: Approval flow interrupted or pre-fix data
- **Action**: Backfill receipt number via admin script or mark Unpaid and re-approve

### 7. Invalid receiptNumber format (Paid invoices)

- `receiptNumber` present but not numeric
- **Root cause**: Bad data
- **Action**: Correct to valid numeric value

### 8. Balance inconsistency

- Member has all invoices Paid but balance shows outstanding
- **Root cause**: Stale or incorrect balance
- **Action**: Recalculate and update member balance

---

## How to Run the Audit

```bash
node server/scripts/dataAuditReport.js
```

**Output:** Table with Member ID, Phone, Issue Type, Root Cause, Required Action

**Exit codes:**

- `0` – No issues
- `1` – DATA CLEANUP REQUIRED
- `2` – CODE FIX REQUIRED (legit bugs found)

---

## Classification Rules

| Scenario | Classification |
|----------|----------------|
| Member creation fails: "Phone already exists" | **EXPECTED SYSTEM BLOCK** (or DUPLICATE MEMBER ATTEMPT) |
| Member creation fails: "Member ID already exists" | **EXPECTED SYSTEM BLOCK** (or DUPLICATE MEMBER ATTEMPT) |
| Member creation fails: "Email already exists" | **EXPECTED SYSTEM BLOCK** |
| Invoice creation fails: "Invoice already exists for period" | **EXPECTED SYSTEM BLOCK** |
| WhatsApp shows wrong name | **DATA ISSUE** (if fix deployed) or **LEGIT BUG** (if frontend still uses cached data) |
| WhatsApp missing receipt number | **DATA ISSUE** (approval interrupted) or **LEGIT BUG** (if flow bypasses validation) |
| Paid invoice with no receiptNumber in DB | **DATA ISSUE** |
| Duplicate member IDs in DB | **DATA ISSUE** |
| Duplicate phone numbers in DB | **DATA ISSUE** |

---

## System Rules (Enforced by Code)

1. **Member ID** – Unique (sparse index); immutable after creation  
2. **Phone** – Checked for uniqueness on create; normalized format  
3. **Email** – Checked for uniqueness on create  
4. **Invoice** – One per member per period; `memberId` required  
5. **Paid invoice** – `receiptNumber` required and immutable  
6. **WhatsApp** – Built from `GET /api/invoices/:id/whatsapp-data` (DB only)

---

## Verdict Logic

- **DATA CLEANUP REQUIRED** – All issues are DATA ISSUE, DUPLICATE MEMBER ATTEMPT, or EXPECTED SYSTEM BLOCK. System enforces rules correctly.
- **CODE FIX REQUIRED** – One or more LEGIT BUG. System violates business rules; code changes needed.
