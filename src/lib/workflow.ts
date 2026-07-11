export interface ReportWorkflowData {
  status?: string;
  highestStepReached?: number;
  uploadedFileNames?: string[];
}

/**
 * Calculates the highest workflow step reached (1 to 5) for a given report period.
 * Takes the maximum of any stored highestStepReached field and the step inferred
 * from the report's status/uploaded files for backwards compatibility and resilience.
 * 
 * Steps:
 *   1 - Upload Excel
 *   2 - Validate Data
 *   3 - Dashboard
 *   4 - Pre-Report
 *   5 - Report PDF
 */
export function getHighestStep(report: ReportWorkflowData | null | undefined): number {
  if (!report) return 1;

  let inferredStep = 1;
  const status = report.status?.toLowerCase() || '';
  
  if (status === "closed") {
    inferredStep = 5;
  } else if (status === "generated" || status === "approved") {
    inferredStep = 4;
  } else if (status === "validated") {
    inferredStep = 3;
  } else if (Array.isArray(report.uploadedFileNames) && report.uploadedFileNames.length > 0) {
    inferredStep = 2;
  }

  const storedStep = typeof report.highestStepReached === 'number' ? report.highestStepReached : 1;
  return Math.max(storedStep, inferredStep);
}
