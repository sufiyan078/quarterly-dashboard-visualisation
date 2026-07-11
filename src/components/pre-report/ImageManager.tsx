"use client";

import React, { useRef, useState } from "react";
import { Upload, X, Tag, MessageSquare, Image as ImageIcon } from "lucide-react";
import { UploadedImage } from "@/types/preReport";

interface ImageManagerProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
}

export function ImageManager({ images, onImagesChange }: ImageManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<UploadedImage['category']>('warehouse');
  const [tempCaption, setTempCaption] = useState("");

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const newImg: UploadedImage = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url: e.target.result as string,
          caption: tempCaption.trim() || `Image representing ${selectedCategory.replace('_', ' ')}`,
          category: selectedCategory
        };
        onImagesChange([...images, newImg]);
        setTempCaption(""); // reset
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (id: string) => {
    onImagesChange(images.filter(img => img.id !== id));
  };

  const updateCaption = (id: string, caption: string) => {
    onImagesChange(images.map(img => img.id === id ? { ...img, caption } : img));
  };

  const updateCategory = (id: string, category: UploadedImage['category']) => {
    onImagesChange(images.map(img => img.id === id ? { ...img, category } : img));
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Supplemental Evidence & Images
        </h3>
        <span className="text-[10px] font-mono text-slate-500">
          {images.length} Loaded
        </span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Upload warehouse photos or physical count evidence to include in the visual appendix of the report.
      </p>

      {/* Upload Box */}
      <div className="border border-dashed border-slate-800 rounded-xl p-4 bg-slate-950/20 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Image Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as UploadedImage['category'])}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500/50 cursor-pointer"
            >
              <option value="warehouse">Warehouse Photos</option>
              <option value="inventory">Inventory Stock Evidence</option>
              <option value="supporting">Supporting Calculations</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Optional Initial Caption
            </label>
            <input
              type="text"
              value={tempCaption}
              onChange={(e) => setTempCaption(e.target.value)}
              placeholder="e.g. Discrepancy check on Row G..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500/50"
            />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImageUpload(f);
          }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 text-xs text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer font-semibold"
        >
          <Upload className="h-4 w-4" />
          Choose & Upload Evidence Image
        </button>
      </div>

      {/* Uploaded List */}
      {images.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="flex gap-4 p-3 rounded-lg border border-slate-800 bg-slate-950/40 relative group"
            >
              <div className="w-20 h-20 rounded border border-slate-800 overflow-hidden bg-slate-950 flex-shrink-0">
                <img
                  src={img.url}
                  alt={img.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-300 truncate" title={img.name}>
                    {img.name}
                  </span>
                  <button
                    onClick={() => removeImage(img.id)}
                    className="text-slate-500 hover:text-red-400 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2.5 py-1">
                    <Tag className="h-3 w-3 text-slate-500" />
                    <select
                      value={img.category}
                      onChange={(e) => updateCategory(img.id, e.target.value as UploadedImage['category'])}
                      className="bg-transparent border-none text-[10px] text-slate-300 outline-none w-full cursor-pointer"
                    >
                      <option value="warehouse">Warehouse Photos</option>
                      <option value="inventory">Inventory Stock Evidence</option>
                      <option value="supporting">Supporting Calculations</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2.5 py-1">
                    <MessageSquare className="h-3 w-3 text-slate-500" />
                    <input
                      type="text"
                      value={img.caption}
                      onChange={(e) => updateCaption(img.id, e.target.value)}
                      className="bg-transparent border-none text-[10px] text-slate-300 outline-none w-full"
                      placeholder="Add caption..."
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
