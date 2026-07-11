# Product Requirements Document

## Product name
Inventory Analytics & Reporting Portal

## Goal
Create a zero-cost web application for inventory audit reporting. Users upload multiple quarterly inventory Excel files, validate parsed rows, calculate inventory differences, view dashboards, add photo evidence, and generate a meaningful PDF report similar to the old inventory report.

## Primary users
- Admin
- Auditor
- Viewer

## Scope for MVP
### Included
- Firebase Google Login
- Report period creation
- Multi-file Excel upload in browser
- Client-side Excel parsing
- Supplier fallback detection
- Validation screen
- Standard inventory audit calculations
- Dashboard
- Client-side PDF generation
- Local PDF download
- Firestore metadata, parsed rows, summaries, settings, and audit logs

### Excluded from zero-cost MVP
- Firebase Storage
- Cloud Functions
- Cloud Run
- Backend PDF generation
- Permanent storage of original Excel files
- Permanent storage of large photos
- Permanent storage of generated PDFs
- Paid APIs
- AI services

## Success criteria
- User can upload all sample inventory Excel files.
- App extracts rows into one common inventory model.
- Supplier is detected by direct supplier name, file name, description match, or Others.
- User can validate data before dashboard generation.
- Calculations are standard and auditable.
- PDF report has management meaning, not only charts.
- App remains deployable on free Firebase Spark-compatible hosting/static architecture.
