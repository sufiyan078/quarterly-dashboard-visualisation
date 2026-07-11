# Inventory Analytics & Reporting Portal — Start Here

## Final build decision
Build a zero-cost MVP using Firebase Spark plan only.

## Non-negotiable constraints
- Use Firebase Authentication with Google Login.
- Use Firestore for structured business data only.
- Do not use Firebase Cloud Storage in the MVP.
- Do not use Cloud Functions, Cloud Run, paid APIs, AI APIs, servers, or background jobs.
- Parse Excel files in the browser.
- Generate PDF reports in the browser and let the user download them.
- Do not permanently store original Excel files, large photos, or generated PDF files in Firebase.

## Core workflow
1. Login with Google
2. Create report period
3. Upload multiple Excel files locally in browser
4. Parse and normalize rows
5. Validate imported rows
6. Run standard inventory calculations
7. Show dashboard
8. Add compressed photo evidence for the report session
9. Generate PDF in browser
10. Download PDF locally
11. Save report metadata and calculated summary in Firestore

## Build order
1. Foundation + Firebase Auth
2. Report Periods
3. Client-side Excel Parser
4. Supplier Detection
5. Validation Screen
6. Calculation Engine
7. Dashboard
8. Photo Evidence
9. Client-side PDF Generator
10. Historical Reports Metadata
11. Settings

## Important warning
A zero-cost MVP cannot behave like a full cloud document management system. The app can store parsed data and summaries, but the user must download and keep generated PDFs locally unless they approve a paid storage plan later.
