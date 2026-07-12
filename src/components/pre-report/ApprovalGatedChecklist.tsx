"use client";

import React from "react";
import { CheckSquare, Square, Lock, Unlock, AlertTriangle, AlertOctagon, CheckCircle2 } from "lucide-react";
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

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-5 space-y-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-indigo-450" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Quality Assurance &amp; Sign-Off
        </h3>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        Prior to locking the report and opening the PDF compilation window, the QA engine audits data alignment, metadata completion, and formatting constraints.
      </p>

      {/* QA Engine Audit Summary Panel */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">
          QA Engine Audit Status
        </span>
        
        {qaIssues.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-450 text-xs py-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span>All verification checks passed. 0 issues detected.</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {errors.map(issue => (
              <div key={issue.id} className="flex gap-2 p-2 rounded bg-red-500/5 border border-red-500/10 text-[10.5px]">
                <AlertOctagon className="h-3.5 w-3.5 text-red-450 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-red-200 block">Critical Error: {issue.message}</span>
                  {issue.fixSuggestion && <span className="text-slate-400 block mt-0.5">Suggestion: {issue.fixSuggestion}</span>}
                </div>
              </div>
            ))}
            
            {warnings.map(issue => (
              <div key={issue.id} className="flex gap-2 p-2 rounded bg-amber-500/5 border border-amber-500/10 text-[10.5px]">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-450 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-200 block">Warning: {issue.message}</span>
                  {issue.fixSuggestion && <span className="text-slate-400 block mt-0.5">Suggestion: {issue.fixSuggestion}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">
          Manual Sign-off Gating
        </span>
        {checklist.map(({ key, label, description }) => {
          const checked = approval[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`w-full flex items-start gap-3 p-2.5 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
                checked
                  ? "border-emerald-500/20 bg-emerald-500/5 text-slate-200"
                  : "border-slate-800 bg-slate-950/20 hover:border-slate-700 text-slate-400"
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {checked ? (
                  <CheckSquare className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Square className="h-4 w-4 text-slate-650" />
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
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg hover:from-emerald-400 hover:to-teal-500 cursor-pointer transition-all duration-200 disabled:opacity-50"
          >
            <Unlock className="h-4 w-4" />
            {isSubmitting ? "Locking & Approving..." : "Approve & Go to Report PDF"}
          </button>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 font-bold text-xs uppercase tracking-wider cursor-not-allowed">
            <Lock className="h-4 w-4" />
            Complete Checklist to Approve
          </div>
        )}
      </div>
    </div>
  );
}
