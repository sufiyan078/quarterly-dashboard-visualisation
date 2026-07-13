# Changelog

All notable changes to the Inventory Analytics & Reporting Portal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and adheres to Semantic Versioning.

---

## [1.1.7] - 2026-07-13
### Added
- **Workflow Process Motion Card**: Added an interactive, animated process pipeline card to the Home Dashboard showcasing the flow: Upload data >> Validate date >> Dashboard >> Pre-report >> Report.
- **Layout Rearrangement**: Placed the workflow process motion card above the recent activity logs card on the Home Dashboard page.

### Files Modified
- `src/app/(dashboard)/dashboard/page.tsx`

---

## [1.1.6] - 2026-07-13
### Changed
- **Login Screen Redesign**: Removed the brand values/marketing card from the login view and centered the "System Authentication" card for a cleaner, focused authentication interface.

### Files Modified
- `src/app/login/page.tsx`

---

## [1.1.5] - 2026-07-13
### Changed
- **Upload Drop Zone Resize**: Reduced the size of the "Drag & drop Excel files here" card to half its original height and padding, optimizing spacing and information density on the screen.

### Files Modified
- `src/app/(dashboard)/reports/[id]/upload/page.client.tsx`

---

## [1.1.4] - 2026-07-13
### Changed
- **Upload Screen Layout**: Repositioned the "Selected Files" card directly below the "Drag & drop Excel files here" card for a single-column layout.

### Files Modified
- `src/app/(dashboard)/reports/[id]/upload/page.client.tsx`

---

## [1.1.3] - 2026-07-13
### Removed
- **Upload Screen Cards**: Removed "Privacy", "Engine", "Session", and "Expected Column Structure" cards from the Excel Upload screen to simplify the interface layout.

---

## [1.1.2] - 2026-07-13
### Fixed
- **Firebase Deploy**: Rebuilt production assets and redeployed files to Firebase Hosting to ensure that the previously introduced Firestore `setDoc` updates are successfully reflected in the production app.

---

## [1.1.1] - 2026-07-13
### Fixed
- **Resilient Firestore Operations**: Replaced `updateDoc` with `setDoc(docRef, ..., { merge: true })` across all steps (upload, validation, dashboard, pre-report, and builder phases). This resolves the `No document to update` Firebase error when finalizing the pre-report phase, ensuring that updates succeed even if document metadata is loaded in dynamic or transient sessions.

### Files Modified
- `src/app/(dashboard)/reports/[id]/builder/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/dashboard/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/pre-report/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/upload/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/validate/page.client.tsx`

---

## [1.1.0] - 2026-07-13
### Added
- **Premium McKinsey/BCG Consulting Commentary Engine**: Refactored the `insightEngine.ts` narrative generators to produce multi-paragraph, analytical, data-grounded assessments, avoiding placeholder/generic AI texts.
- **Enhanced Page Layout and PDF Typography**: Updated the `Commentary` component in `ExecutiveReportDocument.tsx` to beautifully format and split multi-paragraph texts, adjusting font sizes and line heights to ensure consulting narrative reports fit elegantly on A4 PDF pages.
- **Premium Builder Refinement**: Completed visual alignment of the report editor panels and preview elements to ensure a high-fidelity WYSIWYG experience.

### Files Modified
- `src/lib/report/insightEngine.ts`
- `src/components/pre-report/ExecutiveReportDocument.tsx`

---

## [1.0.0] - 2026-07-13
### Added
- **Design Token System**: Centralized design parameters in `src/lib/report/designTokens.ts` including corporate colors (Navy/Gold), layout dimensions, and typography.
- **Dynamic Table of Contents**: Added structured page auto-indexing on the second page of the report.
- **Automated QA Engine**: Integrated narrative, template placeholder, and quantitative financial audits (`qaEngine.ts`) with custom audit logs.
- **QA-Gated Approval UI**: Interlocked the QA reports with the "Sign-Off & Approve" checklist to prevent PDF downloads when critical discrepancies exist.
- **Branded Appendix**: Styled the personnel and evidence summary pages to match corporate templates.

### Files Modified
- `src/lib/report/designTokens.ts`
- `src/lib/report/qaEngine.ts`
- `src/types/preReport.ts`
- `src/components/pre-report/ExecutiveReportDocument.tsx`
- `src/components/pre-report/ApprovalGatedChecklist.tsx`
- `src/app/(dashboard)/reports/[id]/pre-report/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/builder/page.client.tsx`
- `tsconfig.json`

---

## [0.14.1] - 2026-07-13
### Fixed
- **Firestore Document Size Limit Exception**: Reduced `CHUNK_SIZE` from 1500 to 500 rows in chunked writes to guarantee document payloads remain safely below the 1 MB Firestore limit, resolving the validation save failure on large datasets.

### Files Modified
- `src/app/(dashboard)/reports/[id]/validate/page.client.tsx`
- `CHANGELOG.md`

### Reason
- Resolve error "Failed to run calculations and save records" when attempting to validate and move to dashboard with large dataset imports.

---

## [0.14.0] - 2026-07-12
### Added
- **Adaptive Chunk Saving**: Implemented 1500-row configurable chunk size writes on the Validate page to write typical datasets in a single pass.
- **Batched Persistence Writes**: Configured transactional `writeBatch` in Firestore for inventory items and aging records to reduce write network latency.
- **Concurrent Subcollection Loading**: Parallelized sequential subcollection reads using `Promise.all` across the Dashboard, Pre-Report, and Report Builder pages.
- **State Persistence**: Cached parsed inventory workbook data in sessionStorage within `InventoryDataProvider` to survive page reloads and back-navigation.
- **Routing Cleanliness**: Enabled clean URLs in Firebase hosting.

### Files Modified
- `src/app/(dashboard)/reports/[id]/validate/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/dashboard/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/pre-report/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/builder/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/upload/page.client.tsx`
- `src/context/InventoryDataContext.tsx`
- `firebase.json`
- `CHANGELOG.md`

### Reason
- Optimize transition latency from Validate Data screen to Dashboard and improve overall UI performance.

---

## [0.13.0] - 2026-07-12
### Added
- **Firebase Live Deployment**: Deployed the fully optimized local changes to the live Firebase web app.

---

## [0.12.0] - 2026-07-12
### Added
- **Unique Item IDs**: Modified `computeRowMetrics` in `calculations.ts` to assign a unique ID to every inventory row (composed of `reportId`, `sheetName`, `originalRowNumber`, and mapped `idx`).
- **Database & UI Key Resolution**: Swapped fallback keys in `dashboard`, `pre-report`, and `builder` views to utilize `item.id`, eliminating the duplicate React key `chunk_0` error.

### Files Modified
- `src/lib/inventory/calculations.ts`
- `package.json`

### Reason
- Fix duplicate React key warning/error during navigation and rendering.

---

## [0.11.0] - 2026-07-12
### Identified
- **Duplicate Key Warnings**: Diagnosed React console errors caused by using the Firestore document ID (`chunk_0`, `chunk_1`) as the fallback React key for mapped rows.

---

## [0.10.3] - 2026-07-12
### Added
- **Dynamic Route Fallback Hook**: Added a custom `useReportId` hook to resolve production URL parsing issues resulting from Next.js static HTML export constraints on wildcard rewrites.

### Files Modified
- `src/lib/useReportId.ts`
- `src/app/(dashboard)/reports/[id]/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/upload/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/validate/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/dashboard/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/builder/page.client.tsx`
- `src/app/(dashboard)/reports/[id]/pre-report/page.client.tsx`

### Reason
- Fix the dynamic routing bug where useParams() returned "placeholder" in production.

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
