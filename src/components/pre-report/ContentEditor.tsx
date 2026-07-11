"use client";

import React from "react";
import { EditableContent } from "@/types/preReport";

interface ContentEditorProps {
  content: EditableContent;
  onContentChange: (content: EditableContent) => void;
}

export function ContentEditor({ content, onContentChange }: ContentEditorProps) {
  const update = (field: keyof EditableContent, value: string) => {
    onContentChange({ ...content, [field]: value });
  };

  const sections: { key: keyof EditableContent; label: string; placeholder: string; description: string }[] = [
    {
      key: 'executiveSummary',
      label: 'Executive Summary & Audit Conclusion',
      description: 'Overall narrative of the audit, highlighting major discrepancies and conclusions.',
      placeholder: 'Enter executive summary text...'
    },
    {
      key: 'observations',
      label: 'Key Observations',
      description: 'Specific inventory patterns, procedural gaps, or noteworthy findings observed during reconciliation.',
      placeholder: 'Enter key observations...'
    },
    {
      key: 'recommendations',
      label: 'Operational Recommendations',
      description: 'Actionable steps and corrections for the client to mitigate inventory discrepancy risks.',
      placeholder: 'Enter actionable recommendations...'
    },
    {
      key: 'auditorRemarks',
      label: 'Auditor Verification Remarks',
      description: 'Formal sign-off notes or audit qualifications regarding data completeness or limitations.',
      placeholder: 'Enter final auditor remarks...'
    }
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-5 space-y-5">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
        Report Content Editor
      </h3>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Customize the descriptive narratives of your report. These will render live in the preview and will be compiled into the final PDF.
      </p>

      <div className="space-y-4">
        {sections.map(({ key, label, placeholder, description }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-200">
                {label}
              </span>
              <span className="text-[10px] text-slate-500">
                {description}
              </span>
            </div>
            <textarea
              value={content[key]}
              onChange={(e) => update(key, e.target.value)}
              rows={4}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 resize-none placeholder-slate-600 font-sans leading-relaxed"
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
