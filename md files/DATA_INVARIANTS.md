# Data Invariants

## Member Identity Rules
- `members.id` is the only business identifier; it must be unique, non-empty, and never reused.
- MongoDB `_id` values are internal only. APIs and services must never expose or accept them for business logic.
- When onboarding members, populate `members.id` immediately. Use `server/scripts/fixMemberBusinessIds.js --mapping="scripts/memberIdMapping.json"` to assign IDs to legacy rows (dry-run first, then rerun with `--apply`).

## Invoice Linkage Rules
- `invoices.memberId` must always match an existing `members.id`. ObjectId strings are rejected at API, schema, and database levels.
- Invoice documents must not persist `memberName` or `memberEmail`; all presentation data must be resolved from the members collection as needed.
- Collection validator enforced by startup (`$jsonSchema` shown below) blocks inserts lacking a non-empty `memberId`:

```json
{
  "validator": {
    "$jsonSchema": {
      "bsonType": "object",
      "required": ["memberId"],
      "properties": {
        "memberId": {
          "bsonType": "string",
          "minLength": 1,
          "description": "memberId must be the member's business identifier (non-empty string)"
        }
      },
      "additionalProperties": true
    }
  },
  "validationLevel": "moderate",
  "validationAction": "error"
}
```

## Integrity + Fixer Workflow
1. **Dry-run data repairs** – Always run fixer scripts (legacy invoice repair, member ID assignment) without `--apply` first and review logs.
2. **Apply when clean** – Re-run with `--apply` only after confirming planned changes.
3. **Monitor startup logs** – On boot, the API logs duplicate `members.id` values and orphan invoices; investigate any ❌ entries immediately.
4. **No auto-fixes in production** – Startup checks warn but do not mutate data automatically; deliberate scripts must be used for corrections.

## Runbook
- **Duplicate `members.id` reported at startup**
  - Run `db.members.aggregate([{ $group: { _id: "$id", count: { $sum: 1 }, members: { $push: "$_id" } } }, { $match: { count: { $gt: 1 } } }])` in MongoDB to list offending rows.
  - Decide which member keeps the business ID, assign new IDs to the rest via `server/scripts/memberIdMapping.json` + `fixMemberBusinessIds.js` (dry-run first).
  - Re-run the integrity checks (restart server) to confirm the warning disappears.
- **Orphan invoices detected (memberId not found)**
  - Export the logged invoice IDs and resolve the correct member IDs from the members collection.
  - Update `server/scripts/memberIdMapping.json` and rerun `fixLegacyInvoiceMemberIds.js` / `fixMemberBusinessIds.js` (dry-run then `--apply`).
  - If a member truly no longer exists, archive the invoice manually after finance review.
- **Safe fixer usage**
  1. Run the script without `--apply` and inspect "Would update" logs.
  2. If everything looks correct, rerun with `--apply`.
  3. Commit any script changes along with notes referencing the repair batch.
