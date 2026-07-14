"use client";

import React, { useRef } from "react";
import { Upload, X, Image as ImageIcon, Sparkles, Building, User, Calendar, ShieldAlert } from "lucide-react";
import { CoverPageData } from "@/types/preReport";
import { compressImage } from "@/lib/utils";

interface CoverPageEditorProps {
  cover: CoverPageData;
  onCoverChange: (cover: CoverPageData) => void;
  registerPromise?: <T>(promise: Promise<T>) => Promise<T>;
}

export function CoverPageEditor({ cover, onCoverChange, registerPromise }: CoverPageEditorProps) {
  const companyLogoRef = useRef<HTMLInputElement>(null);
  const clientLogoRef = useRef<HTMLInputElement>(null);

  const update = (field: keyof CoverPageData, value: string) => {
    onCoverChange({ ...cover, [field]: value });
  };

  const handleLogoUpload = async (field: 'companyLogoUrl' | 'clientLogoUrl', file: File) => {
    if (!file) return;
    if (file.size === 0) {
      alert("Selected logo file is empty (0 bytes).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Logo file exceeds the maximum 5MB size limit.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Unsupported file format. Please upload an image file (PNG, JPG, JPEG).");
      return;
    }

    const uploadPromise = (async () => {
      try {
        console.log(`[CoverPageEditor] Starting logo compression/upload for ${field}...`);
        const compressedUrl = await compressImage(file, 400, 0.7);
        if (compressedUrl) {
          update(field, compressedUrl);
          console.log(`[CoverPageEditor] Logo compression/upload finished for ${field}.`);
        }
      } catch (err) {
        console.error(`[CoverPageEditor] Error uploading/compressing logo for ${field}:`, err);
        throw err;
      }
    })();

    if (registerPromise) {
      registerPromise(uploadPromise);
    }
    await uploadPromise;
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-5 space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Cover Page Designer
        </h3>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Upload corporate identity assets and define executive metadata. These parameters configure the PDF frontispiece live.
      </p>

      {/* Visual Identity Logo Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Company Logo Card */}
        <div className="rounded-lg border border-slate-800/80 bg-slate-950/20 p-4 space-y-3 flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-550 uppercase tracking-widest block">
              Company logo
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Corporate identity logo of the auditor or service provider.
            </span>
          </div>

          <div className="pt-2">
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
              <div className="relative group rounded-lg border border-slate-800 bg-slate-900/40 p-3 flex items-center justify-center h-20 transition-all duration-200 hover:border-slate-700">
                <img
                  src={cover.companyLogoUrl}
                  alt="Company logo"
                  className="max-h-14 max-w-full object-contain"
                />
                <button
                  onClick={() => update('companyLogoUrl', '')}
                  className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 rounded-full p-1 shadow-lg cursor-pointer transition-colors"
                  title="Remove logo"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => companyLogoRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-4 rounded-lg border border-dashed border-slate-800 bg-slate-950/30 text-xs text-slate-500 hover:border-indigo-500/40 hover:text-indigo-400 transition-all duration-200 cursor-pointer"
              >
                <Upload className="h-4 w-4 text-slate-500 group-hover:text-indigo-400" />
                <span className="font-semibold text-[11px]">Upload Auditor Logo</span>
              </button>
            )}
          </div>
        </div>

        {/* Client Logo Card */}
        <div className="rounded-lg border border-slate-800/80 bg-slate-950/20 p-4 space-y-3 flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-550 uppercase tracking-widest block">
              is certified by
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Logo of the corporate client or target division being audited.
            </span>
          </div>

          <div className="pt-2">
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
              <div className="relative group rounded-lg border border-slate-800 bg-slate-900/40 p-3 flex items-center justify-center h-20 transition-all duration-200 hover:border-slate-700">
                <img
                  src={cover.clientLogoUrl}
                  alt="Client logo"
                  className="max-h-14 max-w-full object-contain"
                />
                <button
                  onClick={() => update('clientLogoUrl', '')}
                  className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 rounded-full p-1 shadow-lg cursor-pointer transition-colors"
                  title="Remove logo"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => clientLogoRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-4 rounded-lg border border-dashed border-slate-800 bg-slate-950/30 text-xs text-slate-500 hover:border-indigo-500/40 hover:text-indigo-400 transition-all duration-200 cursor-pointer"
              >
                <ImageIcon className="h-4 w-4 text-slate-500 group-hover:text-indigo-400" />
                <span className="font-semibold text-[11px]">Upload Client Logo</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Structured Text Fields */}
      <div className="space-y-4 pt-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
          Document Metadata
        </span>

        {/* Title and Subtitle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
              <Building className="h-3 w-3 text-slate-500" />
              Report Title
            </label>
            <input
              value={cover.reportTitle}
              onChange={(e) => update('reportTitle', e.target.value)}
              className="w-full bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition-colors placeholder-slate-700 font-sans"
              placeholder="e.g. Q4 2026 Inventory Verification Report"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
              <Building className="h-3 w-3 text-slate-500" />
              Report Subtitle
            </label>
            <input
              value={cover.reportSubtitle}
              onChange={(e) => update('reportSubtitle', e.target.value)}
              className="w-full bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition-colors placeholder-slate-700 font-sans"
              placeholder="e.g. Financial Discrepancy & Valuation Audit"
            />
          </div>
        </div>

        {/* Client & Period */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
              <Building className="h-3 w-3 text-slate-500" />
              Client Name
            </label>
            <input
              value={cover.clientName}
              onChange={(e) => update('clientName', e.target.value)}
              className="w-full bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition-colors placeholder-slate-700 font-sans"
              placeholder="e.g. GAS Arabian Services"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-slate-500" />
              Reporting Period
            </label>
            <input
              value={cover.reportingPeriod}
              onChange={(e) => update('reportingPeriod', e.target.value)}
              className="w-full bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition-colors placeholder-slate-700 font-sans"
              placeholder="e.g. Q4 2026 Cycle"
            />
          </div>
        </div>

        {/* Signatories */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
            <User className="h-3 w-3 text-slate-500" />
            Operational Signatories
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <input
                value={cover.preparedBy}
                onChange={(e) => update('preparedBy', e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-indigo-500/50 transition-colors placeholder-slate-750 font-sans"
                placeholder="Prepared By (e.g. John Doe)"
              />
            </div>
            <div>
              <input
                value={cover.checkedBy}
                onChange={(e) => update('checkedBy', e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-indigo-500/50 transition-colors placeholder-slate-750 font-sans"
                placeholder="Checked By (e.g. Jane Smith)"
              />
            </div>
            <div>
              <input
                value={cover.approvedBy}
                onChange={(e) => update('approvedBy', e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-indigo-500/50 transition-colors placeholder-slate-750 font-sans"
                placeholder="Approved By (e.g. Executive Partner)"
              />
            </div>
          </div>
        </div>

        {/* Confidentiality Statement */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
            <ShieldAlert className="h-3 w-3 text-slate-500" />
            Confidentiality Statement
          </label>
          <textarea
            value={cover.confidentialityStatement}
            onChange={(e) => update('confidentialityStatement', e.target.value)}
            rows={3}
            className="w-full bg-slate-950/40 border border-slate-800/80 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition-colors resize-none placeholder-slate-700 font-sans leading-relaxed"
            placeholder="Enter confidentiality statement..."
          />
        </div>
      </div>
    </div>
  );
}
