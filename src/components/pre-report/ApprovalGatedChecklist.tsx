"use client";

import React from "react";
import { Unlock } from "lucide-react";
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
  onApproveReport,
  isSubmitting = false,
}: ApprovalGatedChecklistProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-5">
      <button
        onClick={onApproveReport}
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg hover:from-emerald-450 hover:to-teal-550 cursor-pointer transition-all duration-200 disabled:opacity-50"
      >
        <Unlock className="h-4 w-4" />
        {isSubmitting ? "Locking & Approving..." : "Approve & Go to Report PDF"}
      </button>
    </div>
  );
}
