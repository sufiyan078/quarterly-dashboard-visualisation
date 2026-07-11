/**
 * Phase 4C: Data Profiling Engine for Import Review
 * 
 * Analyzes imported rows, ignored rows, needs review rows, aging records,
 * and sheet diagnoses to construct a comprehensive profile of the data.
 * 
 * Ensures all calculations handle empty/null/non-numeric values safely.
 * Keep everything in browser memory/context (no mutation of inputs).
 */

import {
  ParsedInventoryRow,
  IgnoredInventoryRow,
  NeedsReviewInventoryRow,
  SheetDiagnosisResult,
  InventoryDataProfile,
  ProfilerRowAccountability,
  ProfilerItemProfile,
  ProfilerOrgProfile,
  ProfilerSupplierProfile,
  ProfilerValueProfile,
  ProfilerQuantityProfile,
  ProfilerAgingProfile,
  ProfilerWarning
} from "../../types/inventory";
import { AgingBucketRecord } from "./types";

export function profileInventoryData(
  parsedRows: ParsedInventoryRow[],
  ignoredRows: IgnoredInventoryRow[],
  needsReviewRows: NeedsReviewInventoryRow[],
  sheetDiagnoses: SheetDiagnosisResult[] = [],
  agingData: AgingBucketRecord[] = []
): InventoryDataProfile {
  
  // 1. Row Accountability
  const totalWorksheetRows = sheetDiagnoses.reduce((acc, d) => acc + d.totalRowsScanned, 0);
  const sumOfParts = parsedRows.length + ignoredRows.length + needsReviewRows.length;
  // If sheetDiagnoses is empty, fallback to sumOfParts
  const expectedTotal = totalWorksheetRows > 0 ? totalWorksheetRows : sumOfParts;
  const accountabilityCheckPassed = sumOfParts === expectedTotal;

  const rowAccountability: ProfilerRowAccountability = {
    totalRows: expectedTotal,
    importedRows: parsedRows.length,
    ignoredRows: ignoredRows.length,
    needsReviewRows: needsReviewRows.length,
    accountabilityCheckPassed,
    integrityCheckPassed: accountabilityCheckPassed,
    totalWorksheetRows: expectedTotal,
    importedInventoryRows: parsedRows.length,
    ignoredTechnicalRows: ignoredRows.length,
  };

  // 2. Item Profile (All candidate rows: parsedRows + needsReviewRows)
  const allCandidateRows = [
    ...parsedRows.map(r => ({ item: r.item, description: r.description })),
    ...needsReviewRows.map(r => {
      // safe fallback parsing item/description from rawRowData if missing
      const item = String(r.rawRowData.item || r.rawRowData.itemCode || r.rawRowData.Material || r.rawRowData.MaterialCode || "").trim();
      const description = String(r.rawRowData.description || r.rawRowData.itemDescription || r.rawRowData.MaterialDescription || "").trim();
      return { item: (r as any).item || item, description: (r as any).description || description };
    })
  ];

  const totalItemRows = allCandidateRows.length;
  let blankItemCount = 0;
  let blankDescriptionCount = 0;
  const itemCounts: Record<string, number> = {};

  for (const row of allCandidateRows) {
    const item = (row.item || "").trim();
    const desc = (row.description || "").trim();

    if (!item) {
      blankItemCount++;
    } else {
      itemCounts[item] = (itemCounts[item] || 0) + 1;
    }

    if (!desc) {
      blankDescriptionCount++;
    }
  }

  const uniqueItemCodes = Object.keys(itemCounts).length;
  const duplicateItemCodes = Object.entries(itemCounts).filter(([_, count]) => count > 1);
  const duplicateItemCodesCount = duplicateItemCodes.length;
  const sampleDuplicateItems = duplicateItemCodes.slice(0, 5).map(([code]) => code);

  const itemProfile: ProfilerItemProfile = {
    totalItemRows,
    uniqueItemCodes,
    duplicateItemCodesCount,
    blankItemCount,
    blankDescriptionCount,
    sampleDuplicateItems,
    duplicateItemCodes: duplicateItemCodes.map(([code]) => code),
    blankItemCodesCount: blankItemCount,
    blankDescriptionsCount: blankDescriptionCount,
  };

  // 3. Organization Profile
  const orgCounts: Record<string, number> = {};
  const orgValues: Record<string, number> = {};
  let blankOrgCount = 0;

  for (const row of parsedRows) {
    const org = (row.org || "").trim();
    if (!org) {
      blankOrgCount++;
    } else {
      orgCounts[org] = (orgCounts[org] || 0) + 1;
      orgValues[org] = (orgValues[org] || 0) + (row.totalValueSar || 0);
    }
  }

  const topOrgsByRowCount = Object.entries(orgCounts)
    .map(([org, count]) => ({ org, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topOrgsByTotalValue = Object.entries(orgValues)
    .map(([org, totalValue]) => ({ org, totalValue }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);

  const organizationProfile: ProfilerOrgProfile = {
    uniqueOrgs: Object.keys(orgCounts).length,
    blankOrgCount,
    topOrgsByRowCount,
    topOrgsByTotalValue,
    topOrgByRows: topOrgsByRowCount[0]?.org,
    topOrgByValue: topOrgsByTotalValue[0]?.org,
    blankOrgsCount: blankOrgCount,
  };

  // 4. Supplier Profile
  const supplierCounts: Record<string, number> = {};
  const supplierValues: Record<string, number> = {};
  let blankSupplierCount = 0;
  let othersSupplierCount = 0;

  for (const row of parsedRows) {
    const supplier = (row.supplier || "").trim();
    if (!supplier) {
      blankSupplierCount++;
    } else {
      if (supplier.toLowerCase() === "others") {
        othersSupplierCount++;
      }
      supplierCounts[supplier] = (supplierCounts[supplier] || 0) + 1;
      supplierValues[supplier] = (supplierValues[supplier] || 0) + (row.totalValueSar || 0);
    }
  }

  const topSuppliersByRowCount = Object.entries(supplierCounts)
    .map(([supplier, count]) => ({ supplier, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topSuppliersByTotalValue = Object.entries(supplierValues)
    .map(([supplier, totalValue]) => ({ supplier, totalValue }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);

  const supplierProfile: ProfilerSupplierProfile = {
    uniqueSuppliers: Object.keys(supplierCounts).length,
    blankSupplierCount,
    othersSupplierCount,
    topSuppliersByRowCount,
    topSuppliersByTotalValue,
    topSupplierByRows: topSuppliersByRowCount[0]?.supplier,
    topSupplierByValue: topSuppliersByTotalValue[0]?.supplier,
    blankSuppliersCount: blankSupplierCount,
  };

  // 5. Value Profile
  let totalInventoryValueSar = 0;
  let blankValueCount = 0;
  let invalidValueCount = 0;
  let zeroValueCount = 0;
  let negativeValueCount = 0;

  for (const row of parsedRows) {
    const val = row.totalValueSar;
    if (val === undefined || val === null) {
      blankValueCount++;
    } else if (isNaN(val)) {
      invalidValueCount++;
    } else {
      totalInventoryValueSar += val;
      if (val === 0) {
        zeroValueCount++;
      } else if (val < 0) {
        negativeValueCount++;
      }
    }
  }

  const topHighestValueItems = [...parsedRows]
    .map(r => ({
      item: r.item,
      description: r.description,
      value: r.totalValueSar || 0
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Determine financialValueStatus
  let financialValueStatus: "not_found" | "all_zero" | "all_blank" | "parsed_successfully" = "not_found";
  
  const hasMappedFinancialColumn = sheetDiagnoses.length > 0
    ? sheetDiagnoses.some(d => d.financialDiscovery?.selectedValueColumn !== null && d.financialDiscovery?.selectedValueColumn !== undefined)
    : false;

  if (!hasMappedFinancialColumn) {
    financialValueStatus = "not_found";
  } else {
    const nonNullVals = parsedRows
      .map(r => r.totalValueSar)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

    if (nonNullVals.length === 0) {
      financialValueStatus = "all_blank";
    } else if (nonNullVals.every(v => v === 0)) {
      financialValueStatus = "all_zero";
    } else {
      financialValueStatus = "parsed_successfully";
    }
  }

  const valueProfile: ProfilerValueProfile = {
    totalInventoryValueSar,
    blankValueCount,
    invalidValueCount,
    zeroValueCount,
    negativeValueCount,
    topHighestValueItems,
    totalInventoryValue: totalInventoryValueSar,
    blankOrInvalidValueCount: blankValueCount + invalidValueCount,
    financialValueStatus,
  };

  // 6. Quantity Profile
  // Determine if there is any quantity data present in the sheet structures
  const hasQuantityData = sheetDiagnoses.some(
    d => d.datasetType === "inventory_count_sheet" || d.datasetType === "mixed_inventory_sheet"
  );

  let totalSystemOnHand = 0;
  let totalPhysicalCount = 0;
  let blankSystemOnHandCount = 0;
  let blankPhysicalCountCount = 0;
  let negativeQuantityCount = 0;
  let variationMismatchCount = 0;

  if (hasQuantityData) {
    for (const row of parsedRows) {
      const soh = row.systemOnHand;
      const phy = row.physicalCount;
      const variance = row.variation;

      if (soh === undefined || soh === null) {
        blankSystemOnHandCount++;
      } else {
        totalSystemOnHand += soh;
        if (soh < 0) negativeQuantityCount++;
      }

      if (phy === undefined || phy === null) {
        blankPhysicalCountCount++;
      } else {
        totalPhysicalCount += phy;
        if (phy < 0) negativeQuantityCount++;
      }

      if (soh !== undefined && soh !== null && phy !== undefined && phy !== null) {
        const expectedVariance = phy - soh;
        if (variance !== expectedVariance) {
          variationMismatchCount++;
        }
      }
    }
  }

  const quantityProfile: ProfilerQuantityProfile = {
    hasQuantityData,
    totalSystemOnHand,
    totalPhysicalCount,
    blankSystemOnHandCount,
    blankPhysicalCountCount,
    negativeQuantityCount,
    variationMismatchCount,
    negativeQuantitiesCount: negativeQuantityCount,
    missingPhysicalCountCount: blankPhysicalCountCount,
  };

  // 7. Aging Profile
  const hasAgingData = agingData && agingData.length > 0;
  let agingBucketRowsMissingItemCode = 0;
  const totalValueByAgingBucket: Record<string, number> = {};
  const activeBuckets = new Set<string>();

  if (hasAgingData) {
    for (const record of agingData) {
      if (!record.itemCode) {
        agingBucketRowsMissingItemCode++;
      }
      for (const [bucket, val] of Object.entries(record.buckets)) {
        if (val && val > 0) {
          activeBuckets.add(bucket);
          totalValueByAgingBucket[bucket] = (totalValueByAgingBucket[bucket] || 0) + val;
        }
      }
    }
  }

  const agingProfile: ProfilerAgingProfile = {
    hasAgingData,
    totalAgingRows: agingData.length,
    detectedAgingBuckets: Array.from(activeBuckets),
    totalValueByAgingBucket,
    agingBucketRowsMissingItemCode,
    valueBreakdownByAgingBucket: totalValueByAgingBucket,
  };

  // 8. Warnings & Quality Flags
  const warnings: ProfilerWarning[] = [];

  // Check supplier threshold
  if (parsedRows.length > 0 && blankSupplierCount / parsedRows.length > 0.1) {
    warnings.push({
      code: "HIGH_MISSING_SUPPLIER",
      message: `High missing supplier count: ${(blankSupplierCount / parsedRows.length * 100).toFixed(1)}% of rows have no mapped supplier.`,
      severity: "warning",
    });
  }

  // Check org threshold
  if (parsedRows.length > 0 && blankOrgCount / parsedRows.length > 0.1) {
    warnings.push({
      code: "HIGH_MISSING_ORG",
      message: `High missing organization count: ${(blankOrgCount / parsedRows.length * 100).toFixed(1)}% of rows have no organization/unit.`,
      severity: "warning",
    });
  }

  // Duplicate items
  if (duplicateItemCodesCount > 0) {
    warnings.push({
      code: "DUPLICATE_ITEM_CODES",
      message: `${duplicateItemCodesCount} duplicate item codes detected. Ensure these are intended multi-location stocks.`,
      severity: "info",
    });
  }

  // Zero values
  if (zeroValueCount > 0) {
    warnings.push({
      code: "ZERO_VALUE_ROWS",
      message: `${zeroValueCount} items have an inventory value of 0.00 SAR.`,
      severity: "info",
    });
  }

  // Negative values
  if (negativeValueCount > 0) {
    warnings.push({
      code: "NEGATIVE_VALUES",
      message: `${negativeValueCount} rows have negative total value.`,
      severity: "error",
    });
  }

  // Quantity variation mismatch
  if (variationMismatchCount > 0) {
    warnings.push({
      code: "QUANTITY_VARIATION_MISMATCH",
      message: `${variationMismatchCount} rows have variation mismatch where Variation !== (Physical - System).`,
      severity: "error",
    });
  }

  // Aging items missing item codes
  if (agingBucketRowsMissingItemCode > 0) {
    warnings.push({
      code: "AGING_ROWS_MISSING_ITEM_CODE",
      message: `${agingBucketRowsMissingItemCode} aging records are missing item codes.`,
      severity: "warning",
    });
  }

  // Low confidence mapping
  const hasLowConfidence = sheetDiagnoses.some(d => d.confidenceLevel === "low");
  if (hasLowConfidence) {
    warnings.push({
      code: "LOW_MAPPING_CONFIDENCE",
      message: "One or more sheets have low mapping confidence. Review detected columns carefully.",
      severity: "warning",
    });
  }

  // Unknown sheets
  const hasUnknownSheets = sheetDiagnoses.some(d => d.datasetType === "unknown_sheet");
  if (hasUnknownSheets) {
    warnings.push({
      code: "UNKNOWN_SHEETS_DETECTED",
      message: "One or more sheets were classified as unknown. Mappings may be incomplete.",
      severity: "warning",
    });
  }

  // Missing financial column warning
  if (valueProfile.financialValueStatus === "not_found") {
    warnings.push({
      code: "MISSING_FINANCIAL_COLUMN",
      message: "No financial value or unit price column was detected in the uploaded files. Total inventory value cannot be computed.",
      severity: "error",
    });
  } else if (valueProfile.financialValueStatus === "all_blank") {
    warnings.push({
      code: "ALL_FINANCIAL_VALUES_BLANK",
      message: "Financial value column was detected, but all cell values are blank/empty.",
      severity: "warning",
    });
  } else if (valueProfile.financialValueStatus === "all_zero") {
    warnings.push({
      code: "ALL_FINANCIAL_VALUES_ZERO",
      message: "Financial value column was detected, but all values are zero.",
      severity: "warning",
    });
  }

  return {
    rowAccountability,
    itemProfile,
    organizationProfile,
    orgProfile: organizationProfile,
    supplierProfile,
    valueProfile,
    quantityProfile,
    agingProfile,
    warnings,
  };
}
