"use client";

import React from "react";
import { Edit3, Sparkles } from "lucide-react";
import { EditableContent } from "@/types/preReport";

interface ContentEditorProps {
  content: EditableContent;
  onContentChange: (content: EditableContent) => void;
}

export function ContentEditor({ content, onContentChange }: ContentEditorProps) {
  const update = (field: keyof EditableContent, value: string) => {
    onContentChange({ ...content, [field]: value });
  };

  const countWords = (text: string) => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
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
      <div className="flex items-center gap-2">
        <Edit3 className="h-4 w-4 text-indigo-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Narrative Content Editor
        </h3>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Customize the descriptive narratives of your report. These updates will reflect live in the document preview on the right.
      </p>

      <div className="space-y-5">
        {sections.map(({ key, label, placeholder, description }) => {
          const text = content[key] || "";
          const wordCount = countWords(text);
          const charCount = text.length;

          return (
            <div key={key} className="space-y-2 rounded-lg border border-slate-800/60 bg-slate-950/20 p-3.5 transition-colors hover:border-slate-800">
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">
                    {label}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                    {description}
                  </span>
                </div>
                <div className="text-[9px] font-mono text-slate-500 text-right flex-shrink-0">
                  {wordCount} words · {charCount} chars
                </div>
              </div>
              <textarea
                value={text}
                onChange={(e) => update(key, e.target.value)}
                rows={4}
                className="w-full bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 resize-y min-h-[90px] placeholder-slate-750 font-sans leading-relaxed transition-colors"
                placeholder={placeholder}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
