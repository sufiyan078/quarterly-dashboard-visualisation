# Changelog

All notable changes to the Inventory Analytics & Reporting Portal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and adheres to Semantic Versioning.

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
