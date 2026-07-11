# Antigravity Master Prompts

## Prompt 1 — Zero-cost foundation
```text
Build a new standalone web application called Inventory Analytics & Reporting Portal.

This must be a zero-cost MVP using Firebase Spark-compatible services only.

Use Firebase Authentication with Google Login and Firestore for structured data.

Do not use Firebase Storage, Cloud Functions, Cloud Run, backend servers, paid APIs, AI APIs, or any service that requires a billing-enabled project.

Excel files must be parsed client-side in the browser. Generated PDF reports must be created client-side in the browser and downloaded locally by the user. Do not permanently store original Excel files, large photos, or generated PDFs in Firebase.

Create the base app with protected routes, Google Login, user profile creation, roles, and pages for Report Periods, Upload, Validation, Dashboard, Report Builder, Historical Reports, and Settings.
```

## Prompt 2 — Report periods
```text
Implement report period management. Each report period must isolate its uploaded file metadata, parsed inventory rows, validation status, calculation summary, dashboard, photo evidence session data, and generated report status. Do not mix data between reports.
```

## Prompt 3 — Excel parser
```text
Implement client-side multi-file Excel parsing using SheetJS/xlsx. The user can select multiple .xlsx files for one report period. Parse in browser memory, detect sheets and headers, map columns to standard inventory fields, and create normalized InventoryItem rows. Do not upload original Excel files to Firebase Storage.
```

## Prompt 4 — Supplier detection
```text
Add supplier detection fallback logic. If supplier name exists, use it. If missing, use source file name. If still missing, compare item description with known supplier keywords/descriptions. If matched, map to that supplier. If not matched, classify as Others. Store supplierDetectionMethod as direct_supplier_name, source_file_name, description_match, or unmatched_others.
```

## Prompt 5 — Validation
```text
Build the validation workspace. Show total files, sheets, rows detected, rows imported, rows skipped, missing fields, duplicate item codes, unknown categories, supplier detection method, description-matched suppliers, and Others classification. Dashboard must remain locked until validation is approved.
```

## Prompt 6 — Calculation engine
```text
Build the standard inventory audit calculation engine using Physical Quantity minus ERP Quantity. Calculate matched items, mismatched items, shortage, excess, match percentage, mismatch percentage, ERP value, physical value, variance value, gross variance value, supplier-wise summary, issue-category summary, and pending action summary.
```

## Prompt 7 — Dashboard
```text
Build the dashboard using only validated and calculated data. Include KPI cards, matched vs mismatched, shortage vs excess, issue category breakdown, supplier-wise variance, top high-risk items, pending action table, and filters. Never show fake sample data.
```

## Prompt 8 — PDF report
```text
Build browser-side PDF generation. The report must include executive summary, inventory accuracy, variance analysis, supplier summary, issue breakdown, high-risk items, pending actions, photo evidence, conclusion, and approval section. The PDF must be downloaded locally and not stored in Firebase Storage.
```
```
