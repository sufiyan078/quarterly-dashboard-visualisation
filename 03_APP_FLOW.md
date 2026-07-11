# Application Flow

## Login flow
```text
Landing Page
→ Sign in with Google
→ Firebase Auth verifies user
→ If new user, create Firestore user profile
→ Dashboard
```

## Report creation flow
```text
Dashboard
→ Create New Report Period
→ Enter title, quarter, year, location, prepared by, checked by, approved by
→ Save draft report
```

## Excel import flow
```text
Open Report Period
→ Upload multiple Excel files in browser
→ Parse locally
→ Detect sheets and headers
→ Normalize inventory rows
→ Run supplier detection
→ Show validation screen
```

## Validation flow
```text
Validation Screen
→ Review rows, warnings, supplier mapping, unknown categories
→ Fix/edit rows if needed
→ Approve validation
→ Run calculation engine
```

## Dashboard flow
```text
Validated Data
→ KPI cards
→ Charts
→ Supplier summary
→ Issue category summary
→ Pending action table
```

## Report flow
```text
Dashboard / Report Builder
→ Add photo evidence for current session
→ Preview narrative report
→ Generate PDF in browser
→ Download PDF locally
→ Save report status as Generated
```
