# Changelog

All notable changes to the Inventory Analytics & Reporting Portal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and adheres to Semantic Versioning.

---

## [0.10.2] - 2026-07-12
### Modified
- **Chunking Logic**: Adjusted chunking size logic for Firestore writes to save/diagnose in chunks of 1500 rows when the dataset is 2000+ rows, and save immediately as a single document write when the dataset has less than 1500 rows.
- **Validation Sidebar Cleanup**: Removed "Classification Stats", "Validation Diagnostics", and "Workspace Confirmed" cards from the validation screen.
- **Full-Width Layout**: Refactored validation dashboard container to utilize full horizontal width.

### Files Modified
- `src/app/(dashboard)/reports/[id]/validate/page.client.tsx`

### Reason
- User requested removal of classification/diagnostics sidebar cards and configure 1500-row chunk size.

---

## [0.10.1] - 2026-07-12
### Added
- **Move to Dashboard Button**: Added a "Move to Dashboard" button to the Data Profile Summary card header on the validation page, allowing direct calculation and routing to the dashboard view.

### Files Modified
- `src/app/(dashboard)/reports/[id]/validate/page.client.tsx`

### Reason
- User requested a button on the validation page to perform the same calculations as "Approve and done calculation" and navigate immediately to the dashboard.

---

## [0.10.0] - 2026-07-11
### Added
- **Pre-Report Analysis Step**: Created a new pre-report setup step (`src/app/(dashboard)/reports/[id]/pre-report/`) including custom UI components (`src/components/pre-report/`) and TypeScript type definitions (`src/types/preReport.ts`).
- **Firebase Hosting Setup**: Added a robust `firebase.json` configuration to handle clean rewrites, caching headers, and routing.
- **Global Glassmorphism Classes**: Added custom style rules in `globals.css` for cards, charts, and modern scrollbars.

### Modified
- **Build & Static Compilation Optimization**: Refactored major interactive pages (`builder`, `dashboard`, `validate`, `upload`, and root `reports/[id]`) into separate clean server-side `page.tsx` wrappers and client-side `*.client.tsx` modules to resolve build time optimization issues.
- **Ignore Local Caches**: Updated `.gitignore` to prevent tracking of local `.firebase/` hosting caches.

---

## [0.3.0] - 2026-07-11
### Modified
- **Settings Layout (3-Column Grid)**: Expanded Settings page width to fill the empty space on the right, and rearranged columns into a 3-column layout. Moved the **System Information** card to the rightmost column.

### Files Modified
- `src/app/(dashboard)/settings/page.tsx`
- `package.json`

### Reason
- User request to utilize the empty space on the right side of the screen by placing the System Information card there.

---

## [0.2.0] - 2026-07-11
### Added
- **System Information Card**: Integrated a new card on the Settings page displaying the active software version, system operational status, environment name, and database provider.

### Files Modified
- `src/app/(dashboard)/settings/page.tsx`

### Reason
- User request to show the current version of the webapp on the settings page.

---

## [0.1.0] - 2026-07-11
### Added
- **Stable Baseline Release (v0.1)**: Established the core versioning baseline for the Inventory Analytics & Reporting Portal.
- **Authentication**: Secure Google Sign-in integration using Firebase Authentication.
- **Modern UI/UX**: Premium "Liquid Glass" card styling, responsive layout, and collapsible sidebar.
- **Theme Support**: Fully integrated Dark and Light mode toggling with consistent colors.
- **Excel Ingestion**: Client-side Excel parsing (`xlsx`) supporting multiple concurrent uploads.
- **Supplier Detection**: Deterministic supplier matching resolver with robust fallback hierarchy.
- **Validation Interface**: Real-time interactive row validation screen featuring high-speed concurrent batch updates.
- **Calculation Engine**: Hardened financial calculations focused on variance analytics and dollar-value risk metrics (replacing legacy aging analytics).
- **PDF Exporting**: In-browser client-side PDF document generation and download using `jspdf` and `html2canvas`.
- **Database Storage**: Seamless storage of report run metadata and summaries to Cloud Firestore.
- **Version Control**: Git repository tracking and version snapshot utility script (`manage-versions.ps1`).
