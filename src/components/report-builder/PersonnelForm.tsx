import React, { useState } from "react";
import { Camera, Upload, Plus } from "lucide-react";
import { PersonnelEntry } from "@/types/personnel";

interface PersonnelFormProps {
  onAdd: (entry: Omit<PersonnelEntry, "id">) => void;
  validationError: string | null;
  onValidationError: (msg: string | null) => void;
}

export const PersonnelForm: React.FC<PersonnelFormProps> = ({
  onAdd,
  validationError,
  onValidationError,
}) => {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [remarks, setRemarks] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 5 MB size limit
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        onValidationError("File is too large. Maximum allowed size is 5 MB.");
        return;
      }

      // Format validation
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
      const fileType = file.type.toLowerCase();
      const fileName = file.name.toLowerCase();
      const hasValidType =
        allowedTypes.includes(fileType) ||
        allowedExtensions.some((ext) => fileName.endsWith(ext));

      if (!hasValidType) {
        onValidationError("Invalid file format. Only JPG, JPEG, PNG, and WebP images are allowed.");
        return;
      }

      onValidationError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      onValidationError("Worker/Person name is required.");
      return;
    }
    if (!role.trim()) {
      onValidationError("Designation/Role is required.");
      return;
    }

    onAdd({
      name: name.trim(),
      role: role.trim(),
      department: department.trim() || undefined,
      remarks: remarks.trim() || undefined,
      photoUrl: photo || undefined,
    });

    // Reset Form
    setName("");
    setRole("");
    setDepartment("");
    setRemarks("");
    setPhoto(null);
    onValidationError(null);
  };

  return (
    <div className="border-t border-slate-800/60 pt-5 space-y-4">
      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
        Add Personnel Entry
      </h4>

      {validationError && (
        <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded">
          {validationError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Worker/Person Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (validationError && e.target.value.trim()) {
                onValidationError(null);
              }
            }}
            placeholder="e.g. John Doe"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs px-3.5 py-2 text-slate-200 focus:outline-none transition-colors"
          />
        </div>

        {/* Designation */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Designation/Role *
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              if (validationError && name.trim() && e.target.value.trim()) {
                onValidationError(null);
              }
            }}
            placeholder="e.g. Inventory Lead"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs px-3.5 py-2 text-slate-200 focus:outline-none transition-colors"
          />
        </div>

        {/* Department/Location */}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Department/Location (Optional)
          </label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Warehouse Section B"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs px-3.5 py-2 text-slate-200 focus:outline-none transition-colors"
          />
        </div>

        {/* Remarks */}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Remarks/Audit Notes (Optional)
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Verified 12 high-risk shortages physically."
            rows={2}
            className="w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs px-3.5 py-2 text-slate-200 focus:outline-none transition-colors resize-none"
          />
        </div>

        {/* Photo Upload */}
        <div className="sm:col-span-2 space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Evidence Photo (Optional)
          </label>
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center flex-shrink-0">
              {photo ? (
                <img src={photo} alt="Upload preview" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-5 w-5 text-slate-700" />
              )}
              {photo && (
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="absolute inset-0 bg-black/75 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold text-red-400 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <label className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              Choose Photo
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </label>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Entry
      </button>
    </div>
  );
};
