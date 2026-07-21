"use client";

import React, { useRef, useState } from "react";
import { Upload, Trash2, Image as ImageIcon, Sparkles, Building2, MoveLeft, MoveRight } from "lucide-react";
import { UploadedImage } from "@/types/preReport";
import { SupplierPerformance } from "@/lib/inventory/dashboardCalculations";
import { compressImage } from "@/lib/utils";

interface SupplierEvidenceManagerProps {
  suppliersByVariance: SupplierPerformance[];
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  registerPromise?: <T>(promise: Promise<T>) => Promise<T>;
}

export function SupplierEvidenceManager({
  suppliersByVariance,
  images,
  onImagesChange,
  registerPromise,
}: SupplierEvidenceManagerProps) {
  const topSuppliers = (suppliersByVariance || []).slice(0, 5);
  const [dragActiveSupplier, setDragActiveSupplier] = useState<string | null>(null);

  const handleUploadForSupplier = async (supplierName: string, filesList: FileList | File[]) => {
    const files = Array.from(filesList || []);
    if (files.length === 0) return;

    const currentSupplierImages = images.filter((img) => img.supplierName === supplierName);
    if (currentSupplierImages.length >= 10) {
      alert(`Maximum of 10 images allowed per supplier spotlight.`);
      return;
    }

    const uploadPromise = (async () => {
      const added: UploadedImage[] = [];
      for (const file of files) {
        if (file.size === 0) {
          alert(`"${file.name}" is empty and was skipped.`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          alert(`"${file.name}" exceeds the 5MB size limit and was skipped.`);
          continue;
        }
        if (!file.type.startsWith("image/")) {
          alert(`"${file.name}" is not an image file and was skipped.`);
          continue;
        }

        try {
          const compressedUrl = await compressImage(file, 800, 0.7);
          if (compressedUrl) {
            added.push({
              id: Math.random().toString(36).substring(2, 11),
              name: file.name,
              url: compressedUrl,
              caption: `${supplierName} Evidence — ${file.name}`,
              category: "Supplier Evidence",
              supplierName: supplierName,
            });
          }
        } catch (err) {
          console.error(`Error uploading image for ${supplierName}:`, err);
        }
      }

      if (added.length > 0) {
        onImagesChange([...images, ...added]);
      }
    })();

    if (registerPromise) {
      registerPromise(uploadPromise);
    }
  };

  const handleDeleteImage = (imageId: string) => {
    onImagesChange(images.filter((img) => img.id !== imageId));
  };

  const handleMoveImage = (supplierName: string, imageId: string, direction: "left" | "right") => {
    const supplierImgs = images.filter((img) => img.supplierName === supplierName);
    const otherImgs = images.filter((img) => img.supplierName !== supplierName);
    const index = supplierImgs.findIndex((img) => img.id === imageId);
    if (index === -1) return;

    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= supplierImgs.length) return;

    const reordered = [...supplierImgs];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    onImagesChange([...otherImgs, ...reordered]);
  };

  if (topSuppliers.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-slate-800 bg-[#0c0e15]/40 text-center">
        <p className="text-xs text-slate-400">No supplier variance data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Container Header */}
      <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-400" />
            Supplier Evidence Manager
          </h3>
          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            Top 5 Spotlight Uploads
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          Upload site photographs and verification evidence for each top variance supplier. These photos render exclusively on each supplier's Spotlight page.
        </p>
      </div>

      {/* Top 5 Supplier Cards */}
      <div className="space-y-4">
        {topSuppliers.map((supplier, rankIdx) => {
          const rank = rankIdx + 1;
          const supplierImgs = images.filter((img) => img.supplierName === supplier.supplier);
          const isDragActive = dragActiveSupplier === supplier.supplier;

          return (
            <SupplierUploadCard
              key={supplier.supplier}
              rank={rank}
              supplier={supplier}
              supplierImgs={supplierImgs}
              isDragActive={isDragActive}
              onDragActiveChange={(active) => setDragActiveSupplier(active ? supplier.supplier : null)}
              onFilesUpload={(files) => handleUploadForSupplier(supplier.supplier, files)}
              onDeleteImage={handleDeleteImage}
              onMoveImage={(imgId, dir) => handleMoveImage(supplier.supplier, imgId, dir)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface SupplierUploadCardProps {
  rank: number;
  supplier: SupplierPerformance;
  supplierImgs: UploadedImage[];
  isDragActive: boolean;
  onDragActiveChange: (active: boolean) => void;
  onFilesUpload: (files: FileList | File[]) => void;
  onDeleteImage: (imageId: string) => void;
  onMoveImage: (imageId: string, direction: "left" | "right") => void;
}

function SupplierUploadCard({
  rank,
  supplier,
  supplierImgs,
  isDragActive,
  onDragActiveChange,
  onFilesUpload,
  onDeleteImage,
  onMoveImage,
}: SupplierUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragActiveChange(true);
  };

  const handleDragLeave = () => {
    onDragActiveChange(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDragActiveChange(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/60 hover:border-slate-700 transition-all p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold font-mono">
            #{rank}
          </span>
          <span className="text-xs font-bold text-white truncate" title={supplier.supplier}>
            {supplier.supplier}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
            SAR {Math.round(supplier.absoluteVarianceValue).toLocaleString()}
          </span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded">
            {supplierImgs.length} photo{supplierImgs.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all ${
          isDragActive
            ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
            : "border-slate-800 hover:border-slate-700 bg-slate-900/30 hover:bg-slate-900/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onFilesUpload(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Upload className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-medium text-slate-300">
            Drag & drop or <span className="text-indigo-400 underline underline-offset-2">Browse Files</span>
          </span>
        </div>
        <p className="text-[9px] text-slate-500 mt-0.5">
          Attach evidence images for {supplier.supplier} Spotlight Page (PNG, JPG up to 5MB)
        </p>
      </div>

      {/* Thumbnail Gallery */}
      {supplierImgs.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Uploaded Evidence ({supplierImgs.length})
          </span>
          <div className="grid grid-cols-2 gap-2">
            {supplierImgs.map((img, idx) => (
              <div
                key={img.id}
                className="group relative rounded-lg border border-slate-800 bg-slate-900/60 p-1.5 flex items-center gap-2 overflow-hidden hover:border-slate-700 transition-all"
              >
                <div className="w-12 h-12 rounded bg-slate-950 flex-shrink-0 overflow-hidden border border-slate-800 flex items-center justify-center">
                  {img.url ? (
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pr-1">
                  <p className="text-[11px] font-semibold text-slate-200 truncate" title={img.name}>
                    {img.name}
                  </p>
                  <p className="text-[9px] text-slate-500 truncate">
                    Spotlight #{rank}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveImage(img.id, "left");
                      }}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                      title="Move Up"
                    >
                      <MoveLeft className="h-3 w-3" />
                    </button>
                  )}
                  {idx < supplierImgs.length - 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveImage(img.id, "right");
                      }}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                      title="Move Down"
                    >
                      <MoveRight className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteImage(img.id);
                    }}
                    className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10 cursor-pointer"
                    title="Delete Image"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
