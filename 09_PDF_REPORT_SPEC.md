# PDF Report Specification — Browser Generated

## Generation method
Generate PDF in the browser using jsPDF, pdfmake, or React-to-PDF style export. Do not use backend generation.

## Storage rule
The PDF is downloaded locally by the user. It is not saved to Firebase Storage in the zero-cost MVP.

## Sections
1. Cover Page
2. Executive Summary
3. Inventory Accuracy Summary
4. Variance Analysis
5. Supplier / Division Summary
6. Reason-wise Issue Breakdown
7. High-risk Items
8. Pending Action Items
9. Photo Evidence
10. Conclusion and Recommendations
11. Approval Section

## Narrative requirement
The PDF should explain what happened.

Example:
"During the selected inventory count period, a total of X items were reviewed across Y suppliers/divisions. Out of these, X items matched with ERP records, resulting in an inventory accuracy of X%. A total of X mismatched items were identified. The major causes of variance were A, B, and C."

## Photo evidence
For zero cost, photos should be used during the current browser session for PDF generation. If saving photos is required, compress them heavily and store only very small images or thumbnails in Firestore after confirming free-tier limits.
