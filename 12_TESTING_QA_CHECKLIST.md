# Testing & QA Checklist

## Auth
- Google Login works.
- New user profile is created in Firestore.
- Protected pages cannot be accessed when logged out.
- Role field exists.

## Zero-cost compliance
- No Firebase Storage usage.
- No Cloud Functions.
- No Cloud Run.
- No backend server required.
- No paid APIs.
- Original Excel files are not stored permanently.
- PDF is generated in browser and downloaded locally.

## Excel import
- Multiple Excel files can be selected.
- All sample files parse.
- Main inventory sheet detected.
- Headers detected.
- Empty/title/subtotal rows skipped.

## Supplier detection
- Direct supplier name works.
- File name supplier detection works.
- Description match works.
- Unknown rows become Others.
- supplierDetectionMethod is visible.

## Validation
- Missing values are flagged.
- Unknown categories are flagged.
- Duplicate item codes are flagged.
- User can approve validation.
- Dashboard locked before approval.

## Calculations
- differenceQty = physicalQty - erpQty.
- Shortage is negative difference.
- Excess is positive difference.
- Match % is correct.
- Supplier summaries are correct.
- Issue category summaries are correct.

## Dashboard
- No fake sample data.
- Filters work.
- KPI cards match calculation summary.

## PDF
- PDF downloads.
- Narrative uses actual numbers.
- Photo evidence appears if added.
- Report status updates to Generated.
