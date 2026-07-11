# Calculation Engine Specification

## Standard formulas
```text
differenceQty = physicalQty - erpQty
absoluteDifferenceQty = abs(differenceQty)
matchedItem = differenceQty === 0
mismatchedItem = differenceQty !== 0
shortageItem = differenceQty < 0
excessItem = differenceQty > 0
matchPercentage = matchedItems / totalItems * 100
mismatchPercentage = mismatchedItems / totalItems * 100
erpValue = erpQty * unitCost
physicalValue = physicalQty * unitCost
varianceValue = physicalValue - erpValue
absoluteVarianceValue = abs(varianceValue)
```

## Summary metrics
- Total items
- Matched items
- Mismatched items
- Match percentage
- Mismatch percentage
- Shortage items
- Excess items
- Total ERP quantity
- Total physical quantity
- Net quantity difference
- Gross quantity difference
- Total ERP value
- Total physical value
- Net variance value
- Gross variance value
- Pending action items
- Closed items

## Breakdowns
- Supplier-wise summary
- Issue category summary
- Status summary
- High variance items
- Missing stock items
- Excess stock items

## Important rule
Dashboard and PDF must use only validated rows. Do not calculate final dashboard from unapproved imported rows.
