"use client";

import React, { useState } from "react";
import {
  CheckSquare, Square, Lock, Unlock, AlertTriangle, AlertOctagon, CheckCircle2, ChevronDown, ChevronUp
} from "lucide-react";
import { ApprovalState } from "@/types/preReport";
import { QAIssue } from "@/lib/report/qaEngine";

interface ApprovalGatedChecklistProps {
  approval: ApprovalState;
  onApprovalChange: (approval: ApprovalState) => void;
  onApproveReport: () => void;
  isSubmitting?: boolean;
  qaIssues: QAIssue[];
}

export function ApprovalGatedChecklist({
  approval,
  onApprovalChange,
  onApproveReport,
  isSubmitting = false,
  qaIssues = []
}: ApprovalGatedChecklistProps) {
  const [showPassedChecks, setShowPassedChecks] = useState(false);

  const toggle = (field: keyof ApprovalState) => {
    onApprovalChange({
      ...approval,
      [field]: !approval[field]
    });
  };

  const checklist: { key: keyof ApprovalState; label: string; description: string }[] = [
    {
      key: 'reportReviewed',
      label: 'Report Scope & Title Verification',
      description: 'Confirm that cover title, subtitle, and reporting period correctly represent this audit cycle.'
    },
    {
      key: 'layoutVerified',
      label: 'Section Sequence & Visibility',
      description: 'Confirm that section order and visibility options are fully configured and styled correctly.'
    },
    {
      key: 'chartsVerified',
      label: 'Financial Variance Accuracy',
      description: 'Verify that computed total variance, coverage rates, and KPI summaries align with validated records.'
    },
    {
      key: 'tablesVerified',
      label: 'Signatory Roles and Sign-Offs',
      description: 'Verify prepared, checked, and approved by names are fully populated and accurate.'
    },
    {
      key: 'readyForExport',
      label: 'Final PDF Readiness Confirmation',
      description: 'Acknowledge that this report is ready to be locked and signed off for PDF compilation.'
    }
  ];

  const errors = qaIssues.filter(issue => issue.severity === "error");
  const warnings = qaIssues.filter(issue => issue.severity === "warning");
  
  const hasErrors = errors.length > 0;
  const allChecked = Object.values(approval).every(Boolean);

  // Define potential rules & check their status
  const rulesList = [
    { id: "meta-title-empty", label: "Report Title is populated" },
    { id: "meta-client-empty", label: "Client / Division name is populated" },
    { id: "meta-prep-empty", label: "Prepared By signatory is populated" },
    { id: "meta-signatories-empty", label: "Auditor signatories are complete" },
    { id: "narr-exec-empty", label: "Executive Summary narrative is populated" },
    { id: "narr-team-images", label: "Supplemental evidence is aligned" },
    { id: "align-div-value", label: "Division values reconcile with total ledger" },
    { id: "align-variance-calc", label: "Net variance calculation reconciles perfectly" },
    { id: "align-high-risk", label: "Gross risk exposure threshold within guidelines" },
    { id: "layout-risk-ledger-overflow", label: "Risk ledger table fits standard page layout" },
    { id: "layout-divisions-overflow", label: "Divisions breakdown fits standard page layout" }
  ];

  const passedRules = rulesList.filter(rule => !qaIssues.some(issue => issue.id === rule.id));

  // Compute Readiness Score
  // Max score = 100.
  // Each error = -15%
  // Each warning = -5%
  // Each unchecked manual item = -5%
  const uncheckedCount = Object.values(approval).filter(v => !v).length;
  const computedScore = Math.max(0, 100 - (errors.length * 15) - (warnings.length * 5) - (uncheckedCount * 5));

  const getScoreColorClass = (score: number) => {
    if (score >= 90) return "from-emerald-500 to-teal-500 text-emerald-400";
    if (score >= 70) return "from-amber-500 to-orange-500 text-amber-400";
    return "from-red-500 to-rose-500 text-rose-400";
  };

  const getScoreStatusText = (score: number) => {
    if (hasErrors) return "Action Required";
    if (score === 100) return "Ready to Publish";
    if (score >= 90) return "Almost Ready";
    return "Incomplete Setup";
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            QA Audit &amp; Sign-Off
          </h3>
        </div>
      </div>

      {/* Premium Readiness Score Widget */}
      <div className="rounded-xl bg-slate-950/50 border border-slate-800/80 p-4 flex items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Overall Readiness Score
          </span>
          <span className={`text-2xl font-black bg-gradient-to-r ${getScoreColorClass(computedScore)} bg-clip-text text-transparent block mt-1`}>
            {computedScore}% Ready
          </span>
          <span className="text-[10.5px] text-slate-400 mt-1 block">
            Status: <span className="font-semibold">{getScoreStatusText(computedScore)}</span>
          </span>
        </div>

        {/* Mini progress ring or gauge bar */}
        <div className="relative w-14 h-14 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-95" viewBox="0 0 36 36">
            <path
              className="text-slate-800"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={`transition-all duration-500 ${computedScore >= 90 ? 'text-emerald-450' : computedScore >= 70 ? 'text-amber-450' : 'text-rose-450'}`}
              strokeWidth="3.5"
              strokeDasharray={`${computedScore}, 100`}
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute text-[11px] font-mono font-bold text-slate-300">{computedScore}%</span>
        </div>
      </div>

      {/* Tiered QA List */}
      <div className="space-y-2.5">
        {/* Tier 1: Red (Critical Errors) */}
        {errors.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">
              Critical Actions Required ({errors.length})
            </span>
            <div className="space-y-1.5">
              {errors.map(issue => (
                <div key={issue.id} className="flex gap-2.5 p-3 rounded-lg bg-red-950/15 border border-red-500/20 text-[11px]">
                  <AlertOctagon className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-red-200 block">{issue.message}</span>
                    {issue.fixSuggestion && (
                      <span className="text-slate-400 block mt-1 font-mono text-[10px]">
                        Suggestion: {issue.fixSuggestion}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier 2: Amber (Warnings) */}
        {warnings.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-amber-450 uppercase tracking-wider block">
              Warnings &amp; Recommendations ({warnings.length})
            </span>
            <div className="space-y-1.5">
              {warnings.map(issue => (
                <div key={issue.id} className="flex gap-2.5 p-3 rounded-lg bg-amber-950/15 border border-amber-500/20 text-[11px]">
                  <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-200 block">{issue.message}</span>
                    {issue.fixSuggestion && (
                      <span className="text-slate-400 block mt-1 font-mono text-[10px]">
                        Suggestion: {issue.fixSuggestion}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier 3: Green Accordion (Passed Checks) */}
        <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-950/20">
          <button
            onClick={() => setShowPassedChecks(!showPassedChecks)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-900/40 cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Passed Audit Checks ({passedRules.length})</span>
            </div>
            {showPassedChecks ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showPassedChecks && (
            <div className="px-3 py-2 border-t border-slate-900/60 bg-slate-950/30 space-y-1.5 max-h-36 overflow-y-auto">
              {passedRules.map(rule => (
                <div key={rule.id} className="flex items-center gap-2 text-[10.5px] text-slate-400 py-0.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500/80" />
                  <span className="truncate">{rule.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual Sign-off Gating */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
          Manual Sign-off Checklist
        </span>
        <div className="space-y-2">
          {checklist.map(({ key, label, description }) => {
            const checked = approval[key];
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`w-full flex items-start gap-3 p-2.5 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
                  checked
                    ? "border-emerald-500/20 bg-emerald-500/5 text-slate-200 hover:bg-emerald-500/10"
                    : "border-slate-800 bg-slate-950/20 hover:border-slate-700/80 text-slate-400"
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {checked ? (
                    <CheckSquare className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Square className="h-4 w-4 text-slate-600" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold block">
                    {label}
                  </span>
                  <span className="text-[10px] text-slate-500 leading-normal block">
                    {description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Gated Action Button */}
      <div className="pt-2">
        {hasErrors ? (
          <div className="w-full flex flex-col items-center gap-1.5 p-3 rounded-lg bg-red-950/20 border border-red-500/20 text-red-300 font-bold text-xs uppercase tracking-wider cursor-not-allowed">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-red-400" />
              <span>Compilation Blocked</span>
            </div>
            <span className="text-[9px] text-slate-400 font-medium normal-case tracking-normal text-center">
              Resolve all critical errors in the QA Engine audit log to enable approval.
            </span>
          </div>
        ) : allChecked ? (
          <button
            onClick={onApproveReport}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg hover:from-emerald-450 hover:to-teal-550 cursor-pointer transition-all duration-200 disabled:opacity-50"
          >
            <Unlock className="h-4 w-4" />
            {isSubmitting ? "Locking & Approving..." : "Approve & Go to Report PDF"}
          </button>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-550 font-bold text-xs uppercase tracking-wider cursor-not-allowed">
            <Lock className="h-4 w-4" />
            Complete Checklist to Approve
          </div>
        )}
      </div>
    </div>
  );
}
