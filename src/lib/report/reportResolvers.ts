export const DEFAULT_CLIENT_NAME = "GAS ARABIAN SERVICES";

/**
 * Shared resolver for client / organization name across Pre-Report, PDF, and PPT.
 * Ensures placeholders like "DEFAULT CLIENT" or empty values fall back cleanly
 * to warehouse name, location, or "GAS ARABIAN SERVICES".
 */
export function resolveClientName(
  clientName?: string,
  warehouseName?: string,
  location?: string
): string {
  const isPlaceholder = (val?: string) =>
    !val ||
    val.trim() === "" ||
    val.toUpperCase() === "DEFAULT CLIENT" ||
    val.toUpperCase() === "DEFAULT";

  if (clientName && !isPlaceholder(clientName)) {
    return clientName.trim();
  }
  if (warehouseName && !isPlaceholder(warehouseName)) {
    return warehouseName.trim();
  }
  if (location && !isPlaceholder(location)) {
    return location.trim();
  }
  return DEFAULT_CLIENT_NAME;
}

/**
 * Shared resolver for reporting period string (e.g., "Q1 2026").
 */
export function resolveReportingPeriod(
  reportingPeriod?: string,
  quarter?: string,
  year?: string | number
): string {
  if (reportingPeriod && reportingPeriod.trim() !== "") {
    return reportingPeriod.trim();
  }
  const q = quarter || "Q1";
  const y = year || new Date().getFullYear();
  return `${q} ${y}`.trim();
}
