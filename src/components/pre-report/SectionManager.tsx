"use client";

import React, { useState } from "react";
import {
  Eye, EyeOff, GripVertical, ChevronDown, ChevronUp,
  Pencil, Check, X, FileText, CheckCircle2, AlertTriangle,
  BarChart3, Table2, Lightbulb, Shield
} from "lucide-react";
import { ReportSection, ReportSectionType } from "@/types/preReport";

interface SectionManagerProps {
  sections: ReportSection[];
  onSectionsChange: (sections: ReportSection[]) => void;
  activeSectionId?: string | null;
  onSectionSelect?: (sectionId: string) => void;
  sectionMeta?: Record<string, {
    charCount?: number;
    wordCount?: number;
    chartCount?: number;
    tableCount?: number;
    insightCount?: number;
    recCount?: number;
    status?: 'complete' | 'review' | 'incomplete';
    riskLevel?: 'Low' | 'Medium' | 'High';
  }>;
}

const SECTION_ICONS: Partial<Record<ReportSectionType, React.ReactNode>> = {
  cover: <FileText className="h-3.5 w-3.5" />,
  toc: <FileText className="h-3.5 w-3.5" />,
  executive: <BarChart3 className="h-3.5 w-3.5" />,
  kpi: <BarChart3 className="h-3.5 w-3.5" />,
  financial: <BarChart3 className="h-3.5 w-3.5" />,
  health: <Shield className="h-3.5 w-3.5" />,
  divisions: <Table2 className="h-3.5 w-3.5" />,
  suppliers: <Table2 className="h-3.5 w-3.5" />,
  distribution: <BarChart3 className="h-3.5 w-3.5" />,
  validation: <Shield className="h-3.5 w-3.5" />,
  risk: <AlertTriangle className="h-3.5 w-3.5" />,
  opportunities: <Lightbulb className="h-3.5 w-3.5" />,
  recommendations: <Lightbulb className="h-3.5 w-3.5" />,
  conclusion: <CheckCircle2 className="h-3.5 w-3.5" />,
  team: <FileText className="h-3.5 w-3.5" />,
};

export function SectionManager({ sections, onSectionsChange, activeSectionId, onSectionSelect, sectionMeta }: SectionManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);

  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const enabledSections = sorted.filter(s => s.enabled);

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

  // Compute page numbers for enabled sections
  const pageMap: Record<string, number> = {};
  enabledSections.forEach((s, i) => {
    pageMap[s.id] = i + 1;
  });

  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'complete':
        return { icon: <CheckCircle2 className="h-3 w-3 text-emerald-400" />, label: 'Complete', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
      case 'review':
        return { icon: <AlertTriangle className="h-3 w-3 text-amber-400" />, label: 'Needs Review', color: 'text-amber-400', bg: 'bg-amber-500/10' };
      default:
        return { icon: <CheckCircle2 className="h-3 w-3 text-slate-500" />, label: 'Ready', color: 'text-slate-400', bg: 'bg-slate-500/10' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Report Structure Header */}
      <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Document Structure
          </h3>
          <span className="text-[10px] font-mono text-slate-500">
            {enabledCount}/{sections.length} sections · {enabledCount} pages
          </span>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${(enabledCount / sections.length) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-indigo-400">{Math.round((enabledCount / sections.length) * 100)}%</span>
        </div>
      </div>

      {/* Section List */}
      <div className="space-y-1">
        {sorted.map((section) => {
          const isExpanded = expandedId === section.id;
          const isEditing = editingTitleId === section.id;
          const isDragOver = dragOverId === section.id;
          const isActive = activeSectionId === section.id;
          const meta = sectionMeta?.[section.id];
          const statusConfig = getStatusConfig(meta?.status);
          const pageNum = pageMap[section.id];

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
                  : isActive
                    ? "border-indigo-500/40 bg-indigo-500/5 ring-1 ring-indigo-500/20"
                    : section.enabled
                      ? "border-slate-800 bg-[#0c0e15]/60 hover:border-slate-700"
                      : "border-slate-900/50 bg-slate-950/20 opacity-40"
              }`}
            >
              {/* Section Header Row */}
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
                onClick={() => {
                  if (section.enabled && onSectionSelect) {
                    onSectionSelect(section.id);
                  }
                }}
              >
                <GripVertical className="h-3.5 w-3.5 text-slate-700 cursor-grab flex-shrink-0" />

                <button
                  onClick={(e) => { e.stopPropagation(); toggleEnabled(section.id); }}
                  className="flex-shrink-0 cursor-pointer"
                  title={section.enabled ? "Hide section" : "Show section"}
                >
                  {section.enabled ? (
                    <Eye className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-slate-600" />
                  )}
                </button>

                {/* Section Icon */}
                <span className={`flex-shrink-0 ${isActive ? 'text-indigo-400' : section.enabled ? 'text-slate-500' : 'text-slate-700'}`}>
                  {SECTION_ICONS[section.type] || <FileText className="h-3.5 w-3.5" />}
                </span>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
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
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
                        {section.title}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditTitle(section); }}
                        className="opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <Pencil className="h-2.5 w-2.5 text-slate-600 hover:text-slate-400" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Page Number Badge */}
                {section.enabled && pageNum && (
                  <span className="text-[9px] font-mono text-slate-500 flex-shrink-0 bg-slate-800/60 px-1.5 py-0.5 rounded">
                    pg {pageNum}
                  </span>
                )}

                {/* Status indicator */}
                {section.enabled && (
                  <span className={`flex-shrink-0 ${statusConfig.color}`}>
                    {statusConfig.icon}
                  </span>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : section.id); }}
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
                  {/* Section Meta Stats */}
                  {meta && section.enabled && (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {meta.insightCount !== undefined && (
                        <div className="bg-slate-900/40 rounded-md px-2.5 py-1.5 text-center">
                          <span className="text-[9px] font-bold text-slate-600 uppercase block">Insights</span>
                          <span className="text-xs font-bold text-indigo-400">{meta.insightCount}</span>
                        </div>
                      )}
                      {meta.chartCount !== undefined && (
                        <div className="bg-slate-900/40 rounded-md px-2.5 py-1.5 text-center">
                          <span className="text-[9px] font-bold text-slate-600 uppercase block">Charts</span>
                          <span className="text-xs font-bold text-slate-300">{meta.chartCount}</span>
                        </div>
                      )}
                      {meta.tableCount !== undefined && (
                        <div className="bg-slate-900/40 rounded-md px-2.5 py-1.5 text-center">
                          <span className="text-[9px] font-bold text-slate-600 uppercase block">Tables</span>
                          <span className="text-xs font-bold text-slate-300">{meta.tableCount}</span>
                        </div>
                      )}
                      {meta.recCount !== undefined && (
                        <div className="bg-slate-900/40 rounded-md px-2.5 py-1.5 text-center">
                          <span className="text-[9px] font-bold text-slate-600 uppercase block">Recs</span>
                          <span className="text-xs font-bold text-amber-400">{meta.recCount}</span>
                        </div>
                      )}
                      {meta.riskLevel && (
                        <div className="bg-slate-900/40 rounded-md px-2.5 py-1.5 text-center">
                          <span className="text-[9px] font-bold text-slate-600 uppercase block">Risk</span>
                          <span className={`text-xs font-bold ${meta.riskLevel === 'High' ? 'text-red-400' : meta.riskLevel === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`}>{meta.riskLevel}</span>
                        </div>
                      )}
                    </div>
                  )}

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
