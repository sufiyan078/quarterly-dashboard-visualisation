# Final Zero-Cost Blueprint

## Final answer to storage question
For the zero-cost MVP, files, photos, and PDFs are handled differently from a paid cloud app:

- Excel files: selected and parsed in the browser; not stored permanently.
- Parsed rows: stored in Firestore.
- Photos: used for current PDF generation session; avoid permanent cloud storage. Optional tiny compressed thumbnails only if needed.
- PDF reports: generated in browser and downloaded locally; not stored in Firebase.
- Report history: Firestore stores metadata and summaries, not the PDF file.

## Why
Permanent file/photo/PDF storage normally requires Cloud Storage and can lead to billing or quota issues. To keep cost zero, avoid cloud file storage.

## Upgrade path later
If the client approves paid storage later, add Firebase Storage paths:
```text
companies/{companyId}/reports/{reportId}/uploads/
companies/{companyId}/reports/{reportId}/photos/
companies/{companyId}/reports/{reportId}/generated-reports/
```

Do not add this in the zero-cost MVP.
