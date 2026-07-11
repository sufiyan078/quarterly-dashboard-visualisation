# Technical Requirements Document

## Architecture
Frontend-only web app with Firebase services.

## Recommended stack
- Next.js or React
- TypeScript
- Tailwind CSS
- Firebase Authentication
- Firestore
- SheetJS/xlsx for browser Excel parsing
- jsPDF or pdfmake for browser PDF generation
- Chart library such as Recharts

## Zero-cost architecture
```text
Browser
  ├─ Firebase Auth: login
  ├─ Firestore: structured data
  ├─ SheetJS: Excel parsing locally
  ├─ Calculation engine: local/client-side
  ├─ Dashboard: local + Firestore data
  └─ PDF generator: browser download
```

## Do not use
- Firebase Storage
- Cloud Functions
- Cloud Run
- Backend server
- Paid APIs
- AI APIs

## Data persistence
Persist only:
- Users
- Companies
- Report periods
- Uploaded file metadata only, not actual file bytes
- Normalized inventory rows
- Calculation summaries
- Settings
- Audit logs
- Optional small photo metadata or compressed thumbnails only if within limits

## File handling
Original Excel files are processed in browser memory. They are not uploaded to cloud storage.

## PDF handling
PDF is generated in the browser and downloaded by the user. Firestore stores only report status and generatedAt metadata, not the PDF file.
