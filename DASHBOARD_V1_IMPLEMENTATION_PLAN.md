# Implementation Plan: Inventory Dashboard V1

This plan details the replacement of the current placeholder-style dashboard with a real, quarterly inventory analytics dashboard using existing validated calculation results.

---

## 1. Objectives & Goals
* **True Reconciliation Analytics**: Replace the static dashboard page with a fully interactive quarterly dashboard.
* **Consistency of Calculations**: Use the official, validated results already produced by the parser and stored in Firestore (`calculatedSummary` and subcollections).
* **Zero Duplication**: Do not create separate formulas; reuse `calculatedSummary` values and perform in-memory breakdowns of the fetched `inventoryItems`.
* **Zero Cost**: Keep all logic browser-side and use CSS/SVG visual graphs without installing paid charting libraries or using server-side processing.
* **Premium UX/UI**: Follow the audit system guidelines (clean visual hierarchy, dark mode, glassmorphism, responsive tables, clear risk markers, and compliance warnings).

---

## 2. Data Sourcing & Architecture
When the dashboard loads:
1. **Report Document**: Load `reports/{id}` to verify metadata and retrieve the pre-computed `calculatedSummary`.
2. **Subcollection - `inventoryItems`**: Fetch all records from the `reports/{id}/inventoryItems` subcollection to enable in-memory calculations of supplier breakdowns, organization breakdowns, status distribution, and high-risk listings.
3. **Subcollection - `agingData`**: Fetch all records from the `reports/{id}/agingData` subcollection to display stock-aging profiles (if present).

### Calculated Fields & Mapping:
* **Total Items Counted**: `summary.totalItems`
* **Matched Items**: `summary.matchedItems` (Match Rate: `summary.matchRate%`)
* **Mismatched Items**: `summary.mismatchedItems` (Mismatch Rate: `summary.mismatchRate%`)
* **Shortage Items Count**: `summary.shortageItemsCount`
* **Excess Items Count**: `summary.excessItemsCount`
* **Gross Variance Value**: Sum of `absoluteVarianceValue` across all items, or simply `summary.totalShortageValue + summary.totalExcessValue`.
* **Net Variance Value**: `summary.netVariance`
* **Pending Action Items**: Count of rows where `status` is `"open"`, `"pending"`, or `"needs_review"`.

---

## 3. UI Component Structure & Wireframe
The dashboard will be laid out in a grid structure optimized for high readability:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Header: Title, Quarter/Year, Status, Navigate to Builder Button         │
├────────────────────────────────────────────────────────────────────────┤
│ KPI Metric Cards Grid (8 KPI cards)                                    │
├───────────────────────────────────┬────────────────────────────────────┤
│ Charts: Matched vs Mismatched     │ Charts: Shortage vs Excess         │
│ (SVG Donut Chart / Accuracy Ring)  │ (CSS Stacked Comparison Bar)       │
├───────────────────────────────────┴────────────────────────────────────┤
│ Breakdown: Issue Category & Status Summary (Open vs Closed)            │
├───────────────────────────────────┬────────────────────────────────────┤
│ Supplier-Wise Variance Breakdown  │ Organization Value Distribution    │
│ (Horizontal CSS bar chart)        │ (Horizontal CSS bar chart)         │
├───────────────────────────────────┴────────────────────────────────────┤
│ Stock Aging Analysis (Bucket Breakdown if Aging Data is available)     │
├────────────────────────────────────────────────────────────────────────┤
│ Advanced Filters Toolbar (Search, Supplier, Issue Cat, Status, Variance)│
├────────────────────────────────────────────────────────────────────────┤
│ Tables Section (Tabs: Top High-Risk Items | Pending Action Items)      │
└────────────────────────────────────────────────────────────────────────┘
```

### Grid Details:
1. **KPI Cards Section (8 Cards)**:
   1. **Total Counted**: `totalItems`
   2. **Accuracy (Match Rate)**: `matchRate%` (Color-coded: Emerald if >=95% compliance, Amber if <95%)
   3. **Shortage Items**: `shortageItemsCount`
   4. **Excess Items**: `excessItemsCount`
   5. **Shortage Value**: `totalShortageValue` SAR
   6. **Excess Value**: `totalExcessValue` SAR
   7. **Net Variance**: `netVariance` SAR
   8. **Pending Action Items**: Count of non-closed items

2. **Executive Visualizations (CSS/SVG)**:
   * **Accuracy Ring (SVG Donut)**: Visualizes `matchedItems` vs `mismatchedItems`.
   * **Shortage vs Excess Balance**: Left-to-right bar displaying the distribution of shortage vs excess value.
   * **Supplier Breakdown**: Top suppliers ranked by total variance value and item count.
   * **Status Progress**: Progress bar illustrating the percentage of "Closed" items vs "Open / Under Review".
   * **Stock Aging profile**: Showing the distribution of inventory value across different aging buckets (e.g. 1-30d, 31-90d, 1yr+), only rendered if aging data is detected.

3. **Advanced Filters Toolbar**:
   * **Search**: Free-text filter for `itemCode` or `description`.
   * **Supplier Dropdown**: Dynamically populated list of suppliers.
   * **Issue Category**: All, Quantity Match, Shortage, Excess.
   * **Status Filter**: All, Open, Pending, Closed, Needs Review.
   * **Variance Filter**: All, High (>= 5,000 SAR), Medium (>= 1,000 SAR), Low (< 1,000 SAR).

4. **Actionable Tables (Tabbed for Clarity)**:
   * **Top High-Risk Items**: Rows sorted by `absoluteVarianceValue` descending. Color indicators for risk levels:
     * *High Risk* (>= 5,000 SAR)
     * *Medium Risk* (>= 1,000 SAR)
     * *Low Risk* (< 1,000 SAR)
   * **Pending Action Table**: Shows rows that need active auditor review/action (status is not `"closed"`), with columns for responsible team and remarks if available.

---

## 4. Design Aesthetics
* **Palette**: Dark-mode primary (`#090b11`), slate panels (`#0c0e15`), with vibrant status colors:
  * **Shortage / Risk**: Rose (`#f43f5e`)
  * **Excess / Count**: Blue (`#3b82f6`) or Sky (`#0ea5e9`)
  * **Match / Compliant**: Emerald (`#10b981`)
  * **Warning / Alert**: Amber (`#f59e0b`)
* **Transitions**: Smooth slide-in animations for lists, hover-grow states on KPIs, and transition animations on filters.
* **Empty State**: Elegant empty state if no validated rows exist.

---

## 5. Development Steps & Execution Plan
1. **Setup state & types**: Ensure all filters and fetched data states are declared with standard TypeScript definitions.
2. **Data Fetching Layer**: Write firestore queries to load the report details, `inventoryItems`, and `agingData`.
3. **Data Aggregator**: Write helper functions inside the page to aggregate supplier and organization breakdowns in-memory.
4. **KPIs and Charts Rendering**: Build the visual elements, including the SVG accuracy donut chart, horizontal bar charts for suppliers, and progress bars.
5. **Interactive Filter Logic**: Connect the filter states to the rendering logic of the tables and breakdowns.
6. **Tabs Component**: Build a clean tabs component to switch between the "High-Risk Items" and "Pending Actions" tables.
7. **Verification**: Run `npm run build` to verify there are no compilation errors. Check with test files to ensure numbers match the validation workspace exactly.
