"use client";

import React, { useRef, useState } from "react";
import { Upload, X, Tag, MessageSquare, Image as ImageIcon, Sparkles, MoveUp, MoveDown } from "lucide-react";
import { UploadedImage } from "@/types/preReport";
import { compressImage } from "@/lib/utils";

interface ImageManagerProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  registerPromise?: <T>(promise: Promise<T>) => Promise<T>;
}

export function ImageManager({ images, onImagesChange, registerPromise }: ImageManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Warehouse Photos");
  const [tempCaption, setTempCaption] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (file.size === 0) {
      alert("Selected evidence file is empty (0 bytes).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Evidence file exceeds the maximum 5MB size limit.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Unsupported file format. Please upload an image file (PNG, JPG, JPEG).");
      return;
    }
    const isDuplicate = images.some(img => img.name === file.name);
    if (isDuplicate) {
      alert(`An evidence image named "${file.name}" has already been uploaded.`);
      return;
    }

    const uploadPromise = (async () => {
      try {
        console.log(`[ImageManager] Starting evidence image compression/upload for ${file.name}...`);
        const compressedUrl = await compressImage(file, 800, 0.7);
        if (compressedUrl) {
          const newImg: UploadedImage = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            url: compressedUrl,
            caption: tempCaption.trim() || `Image representing ${selectedCategory}`,
            category: selectedCategory
          };
          onImagesChange([...images, newImg]);
          setTempCaption(""); // reset
          console.log(`[ImageManager] Evidence image compression/upload finished for ${file.name}.`);
        }
      } catch (err) {
        console.error(`[ImageManager] Error uploading/compressing image ${file.name}:`, err);
        throw err;
      }
    })();

    if (registerPromise) {
      registerPromise(uploadPromise);
    }
    await uploadPromise;
  };

  const removeImage = (id: string) => {
    onImagesChange(images.filter(img => img.id !== id));
  };

  const updateCaption = (id: string, caption: string) => {
    onImagesChange(images.map(img => img.id === id ? { ...img, caption } : img));
  };

  const updateCategory = (id: string, category: string) => {
    onImagesChange(images.map(img => img.id === id ? { ...img, category } : img));
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    onImagesChange(reordered);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Evidence Appendix Manager
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-550 bg-slate-900 px-2 py-0.5 rounded border border-slate-800/80">
          {images.length} Loaded
        </span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Upload physical audit site photos, count check sheets, or supplier signatures to append to the visual appendix page.
      </p>

      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-4 transition-all duration-200 ${
          isDragActive
            ? "border-indigo-500 bg-indigo-500/5"
            : "border-slate-800 bg-slate-950/20 hover:border-slate-750"
        } space-y-4`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Add text
            </label>
            <input
              type="text"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              placeholder="e.g. Warehouse Photos"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-350 outline-none focus:border-indigo-500/50 placeholder-slate-650"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Evidence Description
            </label>
            <input
              type="text"
              value={tempCaption}
              onChange={(e) => setTempCaption(e.target.value)}
              placeholder="e.g. Audit variance verification check..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-350 outline-none focus:border-indigo-500/50 placeholder-slate-650"
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

        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 py-5 rounded-lg border border-slate-800 bg-slate-900/40 text-xs text-slate-450 hover:bg-slate-850 hover:text-indigo-400 hover:border-indigo-500/30 transition-all duration-200 cursor-pointer group"
        >
          <Upload className="h-5 w-5 text-slate-500 group-hover:text-indigo-400 group-hover:scale-105 transition-transform" />
          <div className="text-center">
            <span className="font-semibold text-[11px] block">Drag &amp; drop or click to upload</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Supports PNG, JPG, JPEG up to 5MB</span>
          </div>
        </div>
      </div>

      {/* Uploaded List with Reordering Controls */}
      {images.length > 0 && (
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Evidence Attachments ({images.length})
          </span>
          <div className="grid grid-cols-1 gap-3">
            {images.map((img, index) => (
              <div
                key={img.id}
                className="flex gap-4 p-3 rounded-lg border border-slate-800/80 bg-slate-950/30 relative group items-center"
              >
                {/* Drag / Reorder Controls */}
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => moveImage(index, 'up')}
                    disabled={index === 0}
                    className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 disabled:opacity-20 cursor-pointer"
                    title="Move Up"
                  >
                    <MoveUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveImage(index, 'down')}
                    disabled={index === images.length - 1}
                    className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 disabled:opacity-20 cursor-pointer"
                    title="Move Down"
                  >
                    <MoveDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Image Thumbnail */}
                <div className="w-16 h-16 rounded-lg border border-slate-800 overflow-hidden bg-slate-950 flex-shrink-0 relative group-hover:border-slate-700 transition-colors">
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Details and Inputs */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-300 truncate block max-w-[200px]" title={img.name}>
                      {img.name}
                    </span>
                    <button
                      onClick={() => removeImage(img.id)}
                      className="text-slate-500 hover:text-rose-450 p-1 rounded hover:bg-rose-500/10 cursor-pointer transition-colors"
                      title="Remove image"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/80 rounded px-2.5 py-1">
                      <Tag className="h-3.5 w-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={img.category}
                        onChange={(e) => updateCategory(img.id, e.target.value)}
                        className="bg-transparent border-none text-[10px] text-slate-300 outline-none w-full placeholder-slate-600"
                        placeholder="Add category text..."
                      />
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/80 rounded px-2.5 py-1">
                      <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={img.caption}
                        onChange={(e) => updateCaption(img.id, e.target.value)}
                        className="bg-transparent border-none text-[10px] text-slate-300 outline-none w-full placeholder-slate-600"
                        placeholder="Add caption description..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
