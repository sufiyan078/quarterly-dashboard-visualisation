"use client";

import React, { useRef } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { CoverPageData } from "@/types/preReport";

interface CoverPageEditorProps {
  cover: CoverPageData;
  onCoverChange: (cover: CoverPageData) => void;
}

export function CoverPageEditor({ cover, onCoverChange }: CoverPageEditorProps) {
  const companyLogoRef = useRef<HTMLInputElement>(null);
  const clientLogoRef = useRef<HTMLInputElement>(null);

  const update = (field: keyof CoverPageData, value: string) => {
    onCoverChange({ ...cover, [field]: value });
  };

  const handleLogoUpload = (field: 'companyLogoUrl' | 'clientLogoUrl', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        update(field, e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const fields: { key: keyof CoverPageData; label: string; type: 'text' | 'textarea' }[] = [
    { key: 'reportTitle', label: 'Report Title', type: 'text' },
    { key: 'reportSubtitle', label: 'Report Subtitle', type: 'text' },
    { key: 'clientName', label: 'Client Name', type: 'text' },
    { key: 'reportingPeriod', label: 'Reporting Period', type: 'text' },
    { key: 'preparedBy', label: 'Prepared By', type: 'text' },
    { key: 'checkedBy', label: 'Checked By', type: 'text' },
    { key: 'approvedBy', label: 'Approved By', type: 'text' },
    { key: 'confidentialityStatement', label: 'Confidentiality Statement', type: 'textarea' },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-5 space-y-5">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
        Cover Page Customization
      </h3>

      {/* Logo Uploads */}
      <div className="grid grid-cols-2 gap-4">
        {/* Company Logo */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Company Logo
          </label>
          <input
            ref={companyLogoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLogoUpload('companyLogoUrl', f);
            }}
          />
          {cover.companyLogoUrl ? (
            <div className="relative group">
              <img
                src={cover.companyLogoUrl}
                alt="Company logo"
                className="h-16 w-auto rounded-lg border border-slate-800 object-contain bg-slate-950/40 p-2"
              />
              <button
                onClick={() => update('companyLogoUrl', '')}
                className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="h-2.5 w-2.5 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => companyLogoRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-700 text-xs text-slate-500 hover:border-indigo-500/40 hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Logo
            </button>
          )}
        </div>

        {/* Client Logo */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Client Logo
          </label>
          <input
            ref={clientLogoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLogoUpload('clientLogoUrl', f);
            }}
          />
          {cover.clientLogoUrl ? (
            <div className="relative group">
              <img
                src={cover.clientLogoUrl}
                alt="Client logo"
                className="h-16 w-auto rounded-lg border border-slate-800 object-contain bg-slate-950/40 p-2"
              />
              <button
                onClick={() => update('clientLogoUrl', '')}
                className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="h-2.5 w-2.5 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => clientLogoRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-700 text-xs text-slate-500 hover:border-indigo-500/40 hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Upload Logo
            </button>
          )}
        </div>
      </div>

      {/* Text Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(({ key, label, type }) => (
          <div key={key} className={type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              {label}
            </label>
            {type === 'textarea' ? (
              <textarea
                value={cover[key]}
                onChange={(e) => update(key, e.target.value)}
                rows={2}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 resize-none placeholder-slate-600"
                placeholder={`Enter ${label.toLowerCase()}...`}
              />
            ) : (
              <input
                value={cover[key]}
                onChange={(e) => update(key, e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 placeholder-slate-600"
                placeholder={`Enter ${label.toLowerCase()}...`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
