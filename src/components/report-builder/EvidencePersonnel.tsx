import React, { useState } from "react";
import { Users, UserCheck } from "lucide-react";
import { PersonnelEntry } from "@/types/personnel";
import { PersonnelCard } from "./PersonnelCard";
import { PersonnelForm } from "./PersonnelForm";
import { compressImage } from "@/lib/utils";

interface EvidencePersonnelProps {
  personnelList: PersonnelEntry[];
  setPersonnelList: React.Dispatch<React.SetStateAction<PersonnelEntry[]>>;
}

export const EvidencePersonnel: React.FC<EvidencePersonnelProps> = ({
  personnelList,
  setPersonnelList,
}) => {
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleAdd = (entry: Omit<PersonnelEntry, "id">) => {
    const uniqueId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15);

    const newEntry: PersonnelEntry = {
      id: uniqueId,
      ...entry,
    };
    setPersonnelList((prev) => [...prev, newEntry]);
  };

  const handleRemove = (id: string) => {
    setPersonnelList((prev) => prev.filter((p) => p.id !== id));
  };

  const handleReplacePhoto = async (id: string, file: File) => {
    try {
      // Compress to max 300px since personnel photos are displayed very small
      const compressedUrl = await compressImage(file, 300, 0.7);
      if (compressedUrl) {
        setPersonnelList((prev) =>
          prev.map((p) => (p.id === id ? { ...p, photoUrl: compressedUrl } : p))
        );
      }
    } catch (err) {
      console.error("Error compressing replaced photo:", err);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-400" />
          Evidence & Personnel
        </h3>
        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2.5 py-1 rounded-full uppercase">
          {personnelList.length} {personnelList.length === 1 ? "Entry" : "Entries"}
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Add on-site worker details, department allocations, remarks, and visual evidence before
        generating the final report. Photos are stored locally in browser memory.
      </p>

      {/* Personnel List */}
      {personnelList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800/80 p-8 text-center bg-slate-950/20">
          <UserCheck className="h-8 w-8 text-slate-650 mx-auto mb-2 opacity-40" />
          <p className="text-xs text-slate-400">No personnel or visual evidence entries added yet.</p>
          <p className="text-[10px] text-slate-500 mt-1">
            Use the form below to register audit team or site workers.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {personnelList.map((person) => (
            <PersonnelCard
              key={person.id}
              person={person}
              onRemove={handleRemove}
              onReplacePhoto={handleReplacePhoto}
              onValidationError={setValidationError}
            />
          ))}
        </div>
      )}

      {/* Add Form */}
      <PersonnelForm
        onAdd={handleAdd}
        validationError={validationError}
        onValidationError={setValidationError}
      />
    </div>
  );
};
