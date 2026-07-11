"use client";

import React from "react";
import { CheckSquare, Square, Lock, Unlock, AlertTriangle } from "lucide-react";
import { ApprovalState } from "@/types/preReport";

interface ApprovalGatedChecklistProps {
  approval: ApprovalState;
  onApprovalChange: (approval: ApprovalState) => void;
  onApproveReport: () => void;
  isSubmitting?: boolean;
}

export function ApprovalGatedChecklist({
  approval,
  onApprovalChange,
  onApproveReport,
  isSubmitting = false
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

  const allChecked = Object.values(approval).every(Boolean);

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-5 space-y-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Report Sign-Off Checklist
        </h3>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        To lock this report builder state and generate the final PDF report, you must verify all parameters in this quality assurance checklist.
      </p>

      {/* Checklist items */}
      <div className="space-y-2">
        {checklist.map(({ key, label, description }) => {
          const checked = approval[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
                checked
                  ? "border-emerald-500/20 bg-emerald-500/5 text-slate-200"
                  : "border-slate-800 bg-slate-950/20 hover:border-slate-700 text-slate-400"
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

      {/* Gated Action Button */}
      <div className="pt-2">
        {allChecked ? (
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
