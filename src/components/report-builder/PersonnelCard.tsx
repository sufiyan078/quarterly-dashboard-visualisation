import React from "react";
import { Camera, Upload, Trash2 } from "lucide-react";
import { PersonnelEntry } from "@/types/personnel";

interface PersonnelCardProps {
  person: PersonnelEntry;
  onRemove: (id: string) => void;
  onReplacePhoto: (id: string, file: File) => void;
  onValidationError: (msg: string | null) => void;
}

export const PersonnelCard: React.FC<PersonnelCardProps> = ({
  person,
  onRemove,
  onReplacePhoto,
  onValidationError,
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      onReplacePhoto(person.id, file);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg bg-slate-950/40 border border-slate-900 items-start relative group">
      {/* Photo Preview & Replace */}
      <div className="relative h-24 w-24 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 flex-shrink-0 flex items-center justify-center group/img">
        {person.photoUrl ? (
          <img src={person.photoUrl} alt={person.name} className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-6 w-6 text-slate-600" />
        )}
        <label className="absolute inset-0 bg-black/75 opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-[10px] font-bold text-white text-center p-1">
          <Upload className="h-4 w-4 mb-1 text-indigo-400" />
          Replace Photo
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-200 truncate">{person.name}</h4>
            <p className="text-xs font-medium text-indigo-400">{person.role}</p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(person.id)}
            className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
            title="Remove Entry"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {person.department && (
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <span className="font-semibold text-slate-500 uppercase text-[9px] tracking-wider">
              Dept/Loc:
            </span>{" "}
            {person.department}
          </p>
        )}

        {person.remarks && (
          <p className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-900/80 italic mt-2">
            &ldquo;{person.remarks}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
};
