# Data Cleanup Script – Usage & Verification

## Overview

Safely repairs historical data issues without changing business logic. Run tasks **in exact order** (1 → 2 → 3 → 4 → 5).

## Prerequisites

- Database backup before running
- Audit completed: `node server/scripts/dataAuditReport.js` shows DATA CLEANUP REQUIRED

## Usage

```bash
# Dry run (no changes) – all tasks
node server/scripts/dataCleanup.js

# Dry run – single task
node server/scripts/dataCleanup.js --task=1

# Execute (apply changes) – all tasks
node server/scripts/dataCleanup.js --execute

# Execute – single task
node server/scripts/dataCleanup.js --execute --task=1
```

## Task Order and Scope

| Task | Description | Resolution |
|------|-------------|------------|
| **1** | Paid invoices missing receipt number | Backfill next valid receipt; verify payment exists |
| **2** | Duplicate member phone numbers | Merge to master; archive duplicates; move invoices |
| **3** | Duplicate member IDs (AM/LM) | Keep master; assign new ID to duplicates; archive; move invoices |
| **4** | Duplicate invoices (same member + year) | Keep Paid or latest Unpaid; archive rest |
| **5** | Invoice memberName mismatch | Sync from member.name |

## Safeguards

- **DRY RUN by default** – no changes unless `--execute`
- **Paid invoices never deleted** – only archived when duplicate
- **Receipt numbers** – generated via existing counter (sequential, unique)
- **Member ID reassignment** – uses DisplayIdCounter (AM/LM sequence)
- **Post-cleanup verification** – runs after each execution

## Post-Cleanup Verification

After running with `--execute`, the script runs automatic verification:

- ✓ All Paid invoices have receiptNumber
- ✓ No duplicate phone numbers
- ✓ No duplicate member IDs
- ✓ One invoice per member per year
- ✓ WhatsApp/PDF use DB data (enforced by existing code)

## Re-send Receipts

After Task 1 (backfill), use the admin UI **"Send / Re-send Receipt"** on each affected invoice to deliver correct WhatsApp/PDF. The flow uses `GET /api/invoices/:id/whatsapp-data` (fresh from DB).

## Rollback

Restore from backup if needed. The script does not support automatic rollback.
