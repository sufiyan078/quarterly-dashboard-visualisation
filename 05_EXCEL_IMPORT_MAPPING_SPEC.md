# Excel Import & Mapping Specification

## Principle
The parser must not depend on one fixed Excel format. It should detect sheets, headers, columns, and row data flexibly.

## Processing strategy
1. User selects one or more .xlsx files.
2. Browser reads files using SheetJS/xlsx.
3. Parser scans sheets and identifies likely inventory sheet.
4. Parser detects header row using known keywords.
5. Parser maps columns to standard fields.
6. Parser extracts item-level rows.
7. Parser ignores blank, title, subtotal, and footer rows.
8. Parser runs supplier detection.
9. Parser sends normalized rows to validation screen.

## Common column mappings
- Item Code: item, code, material, part no, item code
- Description: description, item description, material description
- ERP Qty: erp qty, system qty, closing qty, stock qty
- Physical Qty: physical qty, count qty, counted qty, actual qty
- Difference: difference, variance, diff
- Remarks: remarks, reason, comments
- Unit Cost: unit cost, rate, price
- Value: value, amount, stock value

## Supplier detection fallback
Order:
1. Direct supplier name from row/column.
2. Supplier from source file name.
3. Description match against supplier keywords.
4. If none found, classify as Others.

Store:
- supplierName
- detectedSupplierName
- supplierDetectionMethod

Allowed methods:
- direct_supplier_name
- source_file_name
- description_match
- unmatched_others

## Validation warnings
- Missing item code
- Missing description
- Missing ERP quantity
- Missing physical quantity
- Unknown supplier
- Supplier classified as Others
- Unknown issue category
- Duplicate item code
- Non-numeric quantity
- Negative quantity requiring review
