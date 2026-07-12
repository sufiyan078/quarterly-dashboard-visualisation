"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db, doc, getDoc, updateDoc, deleteDoc, setDoc } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useReportId } from "@/lib/useReportId";
import { 
  ArrowLeft, Edit, Save, Trash2, Calendar, MapPin, User, FileSpreadsheet, 
  ChevronRight, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, HelpCircle, FileText
} from "lucide-react";

interface ReportPeriod {
  reportId: string;
  title: string;
  quarter: string;
  year: number;
  location: string;
  warehouseName: string;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  notes: string;
  status: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  uploadedFileNames?: string[];
}

const STATUS_FLOW = ["Draft", "Validated", "Generated", "Approved", "closed"];

export default function ReportPeriodDetails() {
  const router = useRouter();
  const { profile } = useAuth();
  const id = useReportId();

  const [report, setReport] = useState<ReportPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    quarter: "Q1",
    year: new Date().getFullYear(),
    location: "",
    warehouseName: "",
    preparedBy: "",
    checkedBy: "",
    approvedBy: "",
    notes: "",
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

  useEffect(() => {
    if (!id || id === "placeholder") return;
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const docRef = doc(db, "reports", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as ReportPeriod;
          setReport(data);
          setFormData({
            title: data.title || "",
            quarter: data.quarter || "Q1",
            year: data.year || new Date().getFullYear(),
            location: data.location || "",
            warehouseName: data.warehouseName || "",
            preparedBy: data.preparedBy || "",
            checkedBy: data.checkedBy || "",
            approvedBy: data.approvedBy || "",
            notes: data.notes || "",
          });
        } else {
          setError("Report period not found.");
        }
      } catch (err: any) {
        console.error("Error loading report period details:", err);
        setError("Error loading report period. Ensure Firestore is configured properly.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "year" ? parseInt(value) || new Date().getFullYear() : value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.location || !formData.warehouseName || !formData.preparedBy) {
      setError("Please fill out all required fields (Title, Location, Warehouse Name, and Prepared By).");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const docRef = doc(db, "reports", id);
      await setDoc(docRef, {
        ...formData,
        updatedAt: new Date(),
      }, { merge: true });
      
      setReport((prev) => prev ? {
        ...prev,
        ...formData,
        updatedAt: new Date()
      } : null);

      setIsEditing(false);
    } catch (err: any) {
      console.error("Error saving report details:", err);
      setError("Failed to save report details. Check Firestore rules.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!report || report.status.toLowerCase() !== "draft") {
      setError("Only report periods in 'Draft' status can be deleted.");
      return;
    }

    if (!confirm("Are you sure you want to permanently delete this report period? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      const docRef = doc(db, "reports", id);
      await deleteDoc(docRef);
      router.push("/reports");
    } catch (err: any) {
      console.error("Error deleting report:", err);
      setError("Failed to delete the report period.");
      setIsDeleting(false);
    }
  };

  const handlePromoteStatus = async () => {
    if (!report) return;
    const currentIndex = STATUS_FLOW.findIndex(s => s.toLowerCase() === report.status.toLowerCase());
    if (currentIndex === -1 || currentIndex === STATUS_FLOW.length - 1) return;

    const nextStatus = STATUS_FLOW[currentIndex + 1];
    
    setIsPromoting(true);
    setError(null);
    try {
      const docRef = doc(db, "reports", id);
      await setDoc(docRef, {
        status: nextStatus,
        updatedAt: new Date(),
      }, { merge: true });
      
      setReport((prev) => prev ? {
        ...prev,
        status: nextStatus,
        updatedAt: new Date()
      } : null);
    } catch (err: any) {
      console.error("Error promoting report status:", err);
      setError("Failed to promote report status.");
    } finally {
      setIsPromoting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return "bg-sky-500/10 text-sky-455 border border-sky-500/20";
      case "validated":
        return "bg-amber-500/10 text-amber-455 border border-amber-500/20";
      case "generated":
        return "bg-emerald-500/10 text-emerald-455 border border-emerald-500/20";
      case "approved":
        return "bg-indigo-500/10 text-indigo-455 border border-indigo-500/20";
      case "archived":
      case "closed":
        return "bg-purple-500/10 text-purple-455 border border-purple-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-[50vh]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500"></div>
        <span className="mt-4 text-sm text-slate-400">Loading report details...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Report Not Found</h2>
        <p className="text-slate-400 text-sm">The report period you are looking for does not exist or has been deleted.</p>
        <Link 
          href="/reports" 
          className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" /> Back to reports
        </Link>
      </div>
    );
  }

  const currentIndex = STATUS_FLOW.findIndex(s => s.toLowerCase() === report.status.toLowerCase());
  const canDelete = report.status.toLowerCase() === "draft";
  const canPromote = currentIndex !== -1 && currentIndex < STATUS_FLOW.length - 1;
  const nextStatusName = canPromote ? STATUS_FLOW[currentIndex + 1] : "";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                {report.quarter} {report.year}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${getStatusBadge(report.status)}`}>
                {report.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5 leading-snug">
              {report.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-slate-850 px-3.5 py-2 text-xs font-semibold text-slate-350 transition-colors"
            >
              <Edit className="h-3.5 w-3.5" />
              Edit Details
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Metadata & Details */}
        <div className="lg:col-span-2 space-y-6">
          {isEditing ? (
            <form onSubmit={handleSave} className="rounded-xl border border-slate-800/80 bg-[#0c0e15]/60 backdrop-blur-md p-6 space-y-6">
              <h2 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                <Edit className="h-4 w-4 text-indigo-400" />
                Edit Report Period Metadata
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                    Title / Audit Cycle Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-800 bg-[#05070a] px-3.5 py-2 text-sm text-slate-100 placeholder-slate-650 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all outline-none"
                    placeholder="e.g. Q3 2026 Inventory Reconciliation"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                    Fiscal Quarter <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="quarter"
                    value={formData.quarter}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-800 bg-[#05070a] px-3.5 py-2 text-sm text-slate-100 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none"
                  >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                    Calendar Year <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="year"
                    required
                    min={2020}
                    max={2100}
                    value={formData.year}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-800 bg-[#05070a] px-3.5 py-2 text-sm text-slate-100 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                    Location / Branch <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="location"
                    required
                    value={formData.location}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-800 bg-[#05070a] px-3.5 py-2 text-sm text-slate-100 placeholder-slate-650 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none"
                    placeholder="e.g. Dubai Main Office"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                    Warehouse Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="warehouseName"
                    required
                    value={formData.warehouseName}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-800 bg-[#05070a] px-3.5 py-2 text-sm text-slate-100 placeholder-slate-650 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none"
                    placeholder="e.g. Warehouse Zone B"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                    Prepared By (Auditor) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="preparedBy"
                    required
                    value={formData.preparedBy}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-800 bg-[#05070a] px-3.5 py-2 text-sm text-slate-100 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                    Checked By (Supervisor)
                  </label>
                  <input
                    type="text"
                    name="checkedBy"
                    value={formData.checkedBy}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-800 bg-[#05070a] px-3.5 py-2 text-sm text-slate-100 placeholder-slate-650 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none"
                    placeholder="e.g. Jane Doe"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                    Approved By (Finance/Manager)
                  </label>
                  <input
                    type="text"
                    name="approvedBy"
                    value={formData.approvedBy}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-800 bg-[#05070a] px-3.5 py-2 text-sm text-slate-100 placeholder-slate-650 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none"
                    placeholder="e.g. Anwar Ali"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                    Additional Notes & Context
                  </label>
                  <textarea
                    name="notes"
                    rows={4}
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-800 bg-[#05070a] px-3.5 py-2 text-sm text-slate-100 placeholder-slate-650 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none resize-none"
                    placeholder="Enter audit parameters, inventory discrepancies to watch, or specific notes..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="rounded-lg bg-slate-800 hover:bg-slate-750 px-4 py-2 text-xs font-bold text-slate-350 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-xl border border-slate-800/80 bg-[#0c0e15]/60 backdrop-blur-md p-6 space-y-6">
              
              {/* Metadata Details Display */}
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400 mb-4 pb-2 border-b border-slate-800/60">
                  Audit Cycle Metadata
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Period Title</span>
                    <p className="text-slate-200 font-semibold">{report.title}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Audit Cycle ID</span>
                    <p className="text-slate-400 font-mono text-xs">{report.reportId}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quarter / Year</span>
                    <p className="text-slate-200">{report.quarter} {report.year}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Location</span>
                    <div className="flex items-center gap-1.5 text-slate-200">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <span>{report.location}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Warehouse Name</span>
                    <p className="text-slate-200">{report.warehouseName}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date Created</span>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      <span>
                        {report.createdAt?.seconds 
                          ? new Date(report.createdAt.seconds * 1000).toLocaleString() 
                          : report.createdAt 
                            ? new Date(report.createdAt).toLocaleString() 
                            : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Signatories & Staff */}
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400 mb-4 pb-2 border-b border-slate-800/60">
                  Audit Signatories
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-950/40 rounded-lg p-3.5 border border-slate-800/40">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Prepared By</span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="h-6 w-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                        {report.preparedBy.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-slate-200 truncate">{report.preparedBy}</span>
                    </div>
                  </div>
                  <div className="bg-slate-950/40 rounded-lg p-3.5 border border-slate-800/40">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Checked By</span>
                    {report.checkedBy ? (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="h-6 w-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[10px] font-bold text-amber-400">
                          {report.checkedBy.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-200 truncate">{report.checkedBy}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic mt-2">Unassigned</p>
                    )}
                  </div>
                  <div className="bg-slate-950/40 rounded-lg p-3.5 border border-slate-800/40">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Approved By</span>
                    {report.approvedBy ? (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="h-6 w-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                          {report.approvedBy.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-200 truncate">{report.approvedBy}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic mt-2">Unapproved</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Uploaded Files Section */}
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400 mb-3 pb-2 border-b border-slate-800/60">
                  Uploaded Materials
                </h2>
                {report.uploadedFileNames && report.uploadedFileNames.length > 0 ? (
                  <div className="space-y-2">
                    {report.uploadedFileNames.map((fileName, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs text-slate-300"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileSpreadsheet className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span className="truncate">{fileName}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Uploaded</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-800 p-4 text-center">
                    <HelpCircle className="h-6 w-6 text-slate-650 mx-auto" />
                    <p className="text-xs text-slate-500 mt-2">No files uploaded yet. Complete the upload phase first.</p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400 mb-2 pb-2 border-b border-slate-800/60">
                  Notes & Directives
                </h2>
                <div className="rounded-lg bg-slate-950/50 border border-slate-900 p-4">
                  <p className="text-xs text-slate-350 leading-relaxed whitespace-pre-wrap">
                    {report.notes || "No custom instructions or directives are specified for this audit cycle."}
                  </p>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Right Column: Workflow Steps, Actions, Danger Zone */}
        <div className="space-y-6">
          
          {/* Workflow Sequence Tracker */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0c0e15]/60 backdrop-blur-md p-5 space-y-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">
              Audit Progress Workflow
            </h2>
            
            {/* Steps Vertical List */}
            <div className="space-y-3">
              {STATUS_FLOW.map((s, idx) => {
                const isActive = s.toLowerCase() === report.status.toLowerCase();
                const isCompleted = STATUS_FLOW.findIndex(sf => sf.toLowerCase() === report.status.toLowerCase()) > idx;
                
                return (
                  <div key={s} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                        isActive 
                          ? "bg-indigo-500 text-white border-indigo-400 shadow-md shadow-indigo-500/20 scale-110" 
                          : isCompleted
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-950 text-slate-550 border-slate-800"
                      }`}>
                        {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                      {idx < STATUS_FLOW.length - 1 && (
                        <div className={`w-[2px] h-6 mt-1 ${
                          isCompleted ? "bg-emerald-500/20" : "bg-slate-850"
                        }`} />
                      )}
                    </div>
                    <div className="pt-0.5">
                      <span className={`text-xs font-semibold ${
                        isActive ? "text-indigo-400" : isCompleted ? "text-slate-300" : "text-slate-550"
                      }`}>
                        {s}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Workflow Control Button */}
            {canPromote ? (
              <button
                onClick={handlePromoteStatus}
                disabled={isPromoting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition-colors mt-4 shadow-lg shadow-indigo-500/15"
              >
                {isPromoting ? (
                  "Advancing Status..."
                ) : (
                  <>
                    <span>Promote Status to {nextStatusName}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            ) : (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3 flex gap-2 text-[11px] text-emerald-400/90 mt-4">
                <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                <span>This period is finalized in Closed status. Details are locked.</span>
              </div>
            )}
          </div>

          {/* Action Hub (Links to subpages) */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0c0e15]/60 backdrop-blur-md p-5 space-y-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">
              Workspace Steps
            </h2>

            <div className="space-y-2">
              <Link
                href={`/reports/${report.reportId}/upload`}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-800/60 bg-slate-950/20 hover:bg-slate-950/60 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-sky-500/10 flex items-center justify-center text-sky-400">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-white">Step 1: Upload Files</span>
                    <span className="text-[10px] text-slate-500">Ingest supplier inventory excel files</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </Link>

              <Link
                href={`/reports/${report.reportId}/validate`}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-800/60 bg-slate-950/20 hover:bg-slate-950/60 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-white">Step 2: Validate Rows</span>
                    <span className="text-[10px] text-slate-500">Verify discrepancies & row matches</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </Link>

              <Link
                href={`/reports/${report.reportId}/dashboard`}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-800/60 bg-slate-950/20 hover:bg-slate-950/60 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-white">Step 3: View Dashboard</span>
                    <span className="text-[10px] text-slate-500">Reconcile counts & check KPIs</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </Link>

              <Link
                href={`/reports/${report.reportId}/builder`}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-800/60 bg-slate-950/20 hover:bg-slate-950/60 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-white">Step 4: Report Builder</span>
                    <span className="text-[10px] text-slate-500">Compile audit summary & publish PDF</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </Link>
            </div>
          </div>

          {/* Danger Zone: Delete Option */}
          <div className="rounded-xl border border-red-500/10 bg-[#0c0e15]/60 backdrop-blur-md p-5 space-y-4">
            <div>
              <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider">
                Danger Zone
              </h2>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                Deletion is permanent and is only allowed for report periods in <strong>Draft</strong> status.
              </p>
            </div>

            {canDelete ? (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete Draft Period"}
              </button>
            ) : (
              <div className="rounded-lg bg-slate-950/40 border border-slate-900 p-3 text-center text-[10px] text-slate-550 font-semibold">
                Delete lock enabled (Status is {report.status})
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
