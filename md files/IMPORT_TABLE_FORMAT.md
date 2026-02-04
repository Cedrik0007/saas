# Excel/CSV Import Table Format

## Required Columns (First Row Header)

### Minimum Required:
1. **Name** - Member name (required, minimum 2 characters)
2. **Email** - Email address (required, valid format)

### Optional Columns:
3. **Phone** / **WhatsApp** / **Mobile** - Phone number (must include country code, e.g., +852)
4. **Native** / **Native Place** - Place of origin
5. **Status** - Member status (Active/Inactive, default: Active)
6. **Subscription Type** / **Type** - Subscription type (see valid values below)
7. **Subscription Year** / **Year** - Subscription year (1900-2100)
8. **Start Date** / **Date** - Start date (YYYY-MM-DD or Excel date format)

---

## Valid Subscription Type Values

Use **exactly** these values in the "Subscription Type" column:

1. **Annual Member** → Total Fee: **HK$500/year**
   - Membership Fee: HK$250/year
   - Janaza Fund: HK$250/year

2. **Lifetime Janaza Fund Member** → Total Fee: **HK$250/year**
   - Membership Fee: HK$0
   - Janaza Fund: HK$250/year

3. **Lifetime Membership** → Total Fee: **HK$5,250** (first year), then **HK$250/year**
   - Membership Fee: HK$5,000 (one-time payment)
   - Janaza Fund: HK$250/year

4. **Lifetime** (legacy) → Total Fee: **HK$250/year**
   - Default if no subscription type specified

---

## Excel Table Example

| Name        | Email              | Phone         | Native      | Status | Subscription Type              | Subscription Year | Start Date |
|-------------|--------------------|---------------|-------------|--------|--------------------------------|-------------------|------------|
| John Doe    | john@example.com   | +85212345678  | Hong Kong   | Active | Annual Member                  | 2024              | 2024-01-01 |
| Jane Smith  | jane@example.com   | +85298765432  | China       | Active | Lifetime Janaza Fund Member    | 2024              | 2024-02-15 |
| Bob Lee     | bob@example.com    | +85255555555  | India       | Active | Lifetime Membership            | 2024              | 2024-03-01 |
| Alice Wong  | alice@example.com  | +85211111111  | Malaysia    | Active | Lifetime                       | 2024              | 2024-04-01 |

---

## CSV Format Example

```csv
Name,Email,Phone,Native,Status,Subscription Type,Subscription Year,Start Date
John Doe,john@example.com,+85212345678,Hong Kong,Active,Annual Member,2024,2024-01-01
Jane Smith,jane@example.com,+85298765432,China,Active,Lifetime Janaza Fund Member,2024,2024-02-15
Bob Lee,bob@example.com,+85255555555,India,Active,Lifetime Membership,2024,2024-03-01
Alice Wong,alice@example.com,+85211111111,Malaysia,Active,Lifetime,2024,2024-04-01
```

---

## Minimal Format (Only Required Columns)

| Name        | Email              |
|-------------|--------------------|
| John Doe    | john@example.com   |
| Jane Smith  | jane@example.com   |

---

## Important Notes

1. **Column Names**: The system uses flexible matching (case-insensitive, partial match)
   - "Name" matches: "Name", "Member Name", "Full Name"
   - "Email" matches: "Email", "Email Address", "E-mail"
   - "Subscription Type" matches: "Subscription Type", "Type", "Subscription", "Sub Type"

2. **Subscription Type Values**: Must match exactly (case-sensitive):
   - ✅ `Annual Member`
   - ✅ `Lifetime Janaza Fund Member`
   - ✅ `Lifetime Membership`
   - ✅ `Lifetime` (legacy default)

3. **Phone Numbers**: Must include country code (e.g., +852, +86, +91)

4. **Dates**: Can be Excel date format or text format (YYYY-MM-DD)

5. **First Row**: Must be the header row with column names

6. **Empty Rows**: Will be skipped automatically

---

## Subscription Type Fee Summary

| Subscription Type              | First Year | Subsequent Years |
|-------------------------------|------------|------------------|
| Annual Member                 | HK$500     | HK$500           |
| Lifetime Janaza Fund Member   | HK$250     | HK$250           |
| Lifetime Membership           | HK$5,250   | HK$250           |
| Lifetime (legacy)             | HK$250     | HK$250           |

