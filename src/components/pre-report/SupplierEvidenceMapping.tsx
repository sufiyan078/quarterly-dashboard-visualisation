"use client";

import React, { useMemo } from "react";
import { Image as ImageIcon, Link2, X } from "lucide-react";
import { UploadedImage, SupplierImageMapping } from "@/types/preReport";
import { SupplierPerformance } from "@/lib/inventory/dashboardCalculations";

/* ════════════════════════════════════════════════════════════════
   SUPPLIER EVIDENCE MAPPING
   Displayed inside the "Evidence Images" tab of the Pre-Report
   Builder.  Shows the top 5 suppliers (by absolute variance) and
   lets the user assign or override which uploaded evidence image
   appears on each supplier's Spotlight page.
   ════════════════════════════════════════════════════════════════ */

interface SupplierEvidenceMappingProps {
  /** Top suppliers sorted by absolute variance DESC. */
  suppliersByVariance: SupplierPerformance[];
  /** All uploaded proof/evidence images. */
  images: UploadedImage[];
  /** Current supplier → image ID mapping. */
  mapping: SupplierImageMapping;
  /** Called when the mapping changes. */
  onMappingChange: (mapping: SupplierImageMapping) => void;
}

const fmtSAR = (n: number) =>
  `SAR ${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtPct = (n: number) =>
  `${n.toFixed(1)}%`;

export function SupplierEvidenceMapping({
  suppliersByVariance,
  images,
  mapping,
  onMappingChange,
}: SupplierEvidenceMappingProps) {
  const top5 = useMemo(() => suppliersByVariance.slice(0, 5), [suppliersByVariance]);

  if (top5.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Supplier Evidence Mapping
          </h3>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          No supplier data available. Upload inventory data to populate the supplier spotlight pages.
        </p>
      </div>
    );
  }

  const handleAssign = (supplierName: string, imageId: string) => {
    onMappingChange({ ...mapping, [supplierName]: imageId });
  };

  const handleClear = (supplierName: string) => {
    const updated = { ...mapping };
    delete updated[supplierName];
    onMappingChange(updated);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Supplier Evidence Mapping
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-550 bg-slate-900 px-2 py-0.5 rounded border border-slate-800/80">
          {Object.keys(mapping).filter(k => mapping[k]).length} / {top5.length} Mapped
        </span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Assign uploaded evidence images to each of the top 5 suppliers by absolute variance. These images appear on the Supplier Spotlight pages in the PDF report.
      </p>

      {/* Supplier List */}
      <div className="space-y-3">
        {top5.map((supplier, index) => {
          const currentImageId = mapping[supplier.supplier] || null;
          const currentImage = currentImageId ? images.find(img => img.id === currentImageId) : null;
          const riskColor = supplier.absoluteVarianceValue >= 50000
            ? "text-rose-450"
            : supplier.absoluteVarianceValue >= 10000
              ? "text-orange-400"
              : supplier.absoluteVarianceValue >= 1000
                ? "text-amber-400"
                : "text-emerald-400";

          return (
            <div
              key={supplier.supplier}
              className="rounded-lg border border-slate-800/80 bg-slate-950/30 p-3 space-y-2.5"
            >
              {/* Supplier Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex-shrink-0 h-7 w-7 rounded-lg bg-slate-800 border border-slate-700/50 flex items-center justify-center text-[11px] font-extrabold text-amber-400">
                    #{index + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-200 block truncate max-w-[220px]" title={supplier.supplier}>
                      {supplier.supplier}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {supplier.itemCount.toLocaleString()} items · Match {fmtPct(supplier.matchingRate)}
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold ${riskColor} flex-shrink-0`}>
                  {fmtSAR(supplier.absoluteVarianceValue)}
                </span>
              </div>

              {/* Image Selector */}
              <div className="flex items-center gap-2">
                {currentImage ? (
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 bg-slate-900/60 border border-slate-800/80 rounded-lg px-2.5 py-1.5">
                    <div className="w-8 h-8 rounded border border-slate-700/60 overflow-hidden bg-slate-950 flex-shrink-0">
                      <img src={currentImage.url} alt={currentImage.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] text-slate-300 truncate flex-1 min-w-0" title={currentImage.name}>
                      {currentImage.name}
                    </span>
                    <button
                      onClick={() => handleClear(supplier.supplier)}
                      className="text-slate-500 hover:text-rose-450 p-0.5 rounded hover:bg-rose-500/10 cursor-pointer transition-colors flex-shrink-0"
                      title="Remove mapping"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1">
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) handleAssign(supplier.supplier, e.target.value);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-400 outline-none focus:border-indigo-500/50 cursor-pointer appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
                    >
                      <option value="">Select evidence image…</option>
                      {images.map(img => (
                        <option key={img.id} value={img.id}>
                          {img.name} — {img.category}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help text */}
      {images.length === 0 && (
        <p className="text-[10px] text-slate-600 italic">
          Upload evidence images above to start mapping them to suppliers.
        </p>
      )}
    </div>
  );
}
