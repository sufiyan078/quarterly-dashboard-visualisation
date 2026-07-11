"use client";

import React, { useState } from "react";
import {
  Eye, EyeOff, GripVertical, ChevronDown, ChevronUp,
  Pencil, Check, X
} from "lucide-react";
import { ReportSection } from "@/types/preReport";

interface SectionManagerProps {
  sections: ReportSection[];
  onSectionsChange: (sections: ReportSection[]) => void;
}

export function SectionManager({ sections, onSectionsChange }: SectionManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);

  const sorted = [...sections].sort((a, b) => a.order - b.order);

  const toggleEnabled = (id: string) => {
    onSectionsChange(sections.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const updateNotes = (id: string, notes: string) => {
    onSectionsChange(sections.map(s => s.id === id ? { ...s, notes } : s));
  };

  const updateDescription = (id: string, description: string) => {
    onSectionsChange(sections.map(s => s.id === id ? { ...s, description } : s));
  };

  const startEditTitle = (s: ReportSection) => {
    setEditingTitleId(s.id);
    setEditTitleValue(s.title);
  };

  const confirmEditTitle = (id: string) => {
    if (editTitleValue.trim()) {
      onSectionsChange(sections.map(s => s.id === id ? { ...s, title: editTitleValue.trim() } : s));
    }
    setEditingTitleId(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragSourceId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== dragSourceId) setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragSourceId || dragSourceId === targetId) return;

    const sourceIdx = sorted.findIndex(s => s.id === dragSourceId);
    const targetIdx = sorted.findIndex(s => s.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const reordered = [...sorted];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    onSectionsChange(reordered.map((s, i) => ({ ...s, order: i })));
    setDragOverId(null);
    setDragSourceId(null);
  };

  const handleDragEnd = () => {
    setDragOverId(null);
    setDragSourceId(null);
  };

  const enabledCount = sections.filter(s => s.enabled).length;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Report Sections
        </h3>
        <span className="text-[10px] font-mono text-slate-500">
          {enabledCount}/{sections.length} Active
        </span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Drag to reorder • Toggle visibility • Edit titles and descriptions
      </p>

      <div className="space-y-1.5">
        {sorted.map((section) => {
          const isExpanded = expandedId === section.id;
          const isEditing = editingTitleId === section.id;
          const isDragOver = dragOverId === section.id;

          return (
            <div
              key={section.id}
              draggable
              onDragStart={(e) => handleDragStart(e, section.id)}
              onDragOver={(e) => handleDragOver(e, section.id)}
              onDrop={(e) => handleDrop(e, section.id)}
              onDragEnd={handleDragEnd}
              className={`rounded-lg border transition-all duration-200 ${
                isDragOver
                  ? "border-indigo-500/50 bg-indigo-500/5"
                  : section.enabled
                    ? "border-slate-800 bg-slate-950/60"
                    : "border-slate-900/50 bg-slate-950/20 opacity-50"
              }`}
            >
              {/* Section Header Row */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <GripVertical className="h-3.5 w-3.5 text-slate-600 cursor-grab flex-shrink-0" />

                <button
                  onClick={() => toggleEnabled(section.id)}
                  className="flex-shrink-0 cursor-pointer"
                  title={section.enabled ? "Hide section" : "Show section"}
                >
                  {section.enabled ? (
                    <Eye className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-slate-600" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && confirmEditTitle(section.id)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500"
                        autoFocus
                      />
                      <button onClick={() => confirmEditTitle(section.id)} className="cursor-pointer">
                        <Check className="h-3 w-3 text-emerald-400" />
                      </button>
                      <button onClick={() => setEditingTitleId(null)} className="cursor-pointer">
                        <X className="h-3 w-3 text-slate-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {section.title}
                      </span>
                      <button
                        onClick={() => startEditTitle(section)}
                        className="opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <Pencil className="h-2.5 w-2.5 text-slate-600 hover:text-slate-400" />
                      </button>
                    </div>
                  )}
                </div>

                <span className="text-[9px] font-mono text-slate-600 flex-shrink-0 uppercase">
                  {section.type}
                </span>

                <button
                  onClick={() => setExpandedId(isExpanded ? null : section.id)}
                  className="flex-shrink-0 cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  )}
                </button>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-slate-900/60">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Description
                    </label>
                    <input
                      value={section.description}
                      onChange={(e) => updateDescription(section.id, e.target.value)}
                      className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 outline-none focus:border-indigo-500/50"
                      placeholder="Describe this section..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Notes / Comments
                    </label>
                    <textarea
                      value={section.notes}
                      onChange={(e) => updateNotes(section.id, e.target.value)}
                      rows={2}
                      className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 outline-none focus:border-indigo-500/50 resize-none"
                      placeholder="Add notes that will appear beneath this section..."
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
