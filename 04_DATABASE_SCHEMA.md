# Firestore Database Schema — Zero-Cost MVP

## users/{uid}
```json
{
  "uid": "string",
  "name": "string",
  "email": "string",
  "photoURL": "string",
  "role": "admin | auditor | viewer",
  "companyId": "string",
  "status": "active | disabled",
  "createdAt": "timestamp",
  "lastLoginAt": "timestamp"
}
```

## companies/{companyId}
```json
{
  "name": "string",
  "logoBase64Small": "optional string",
  "address": "string",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "createdAt": "timestamp"
}
```

## reports/{reportId}
```json
{
  "companyId": "string",
  "title": "string",
  "quarter": "Q1 | Q2 | Q3 | Q4",
  "year": 2025,
  "location": "string",
  "preparedBy": "string",
  "checkedBy": "string",
  "approvedBy": "string",
  "status": "draft | validated | generated | approved | archived",
  "uploadedFileNames": ["string"],
  "calculatedSummary": {},
  "pdfGeneratedAt": "timestamp optional",
  "pdfStoredExternally": false,
  "createdBy": "uid",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## reports/{reportId}/inventoryItems/{itemId}
```json
{
  "reportId": "string",
  "companyId": "string",
  "sourceFileName": "string",
  "sheetName": "string",
  "supplierName": "string optional",
  "detectedSupplierName": "string",
  "supplierDetectionMethod": "direct_supplier_name | source_file_name | description_match | unmatched_others",
  "itemCode": "string",
  "description": "string",
  "erpQty": 0,
  "physicalQty": 0,
  "differenceQty": 0,
  "absoluteDifferenceQty": 0,
  "unitCost": 0,
  "erpValue": 0,
  "physicalValue": 0,
  "varianceValue": 0,
  "absoluteVarianceValue": 0,
  "issueCategory": "string",
  "remarks": "string",
  "actionRequired": "string",
  "responsibleTeam": "string",
  "status": "open | pending | closed | needs_review",
  "validationWarnings": ["string"],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## reports/{reportId}/uploadedFiles/{fileId}
Metadata only. Do not store file bytes.
```json
{
  "fileName": "string",
  "fileSize": 12345,
  "rowCount": 0,
  "sheetCount": 0,
  "processingStatus": "parsed | warning | failed",
  "uploadedBy": "uid",
  "uploadedAt": "timestamp"
}
```

## settings/suppliers
```json
{
  "suppliers": [
    {"name": "Pepperl+Fuchs", "keywords": ["pepperl", "fuchs", "p+f"]}
  ]
}
```

## auditLogs/{logId}
```json
{
  "companyId": "string",
  "reportId": "string optional",
  "userId": "uid",
  "action": "string",
  "createdAt": "timestamp"
}
```
