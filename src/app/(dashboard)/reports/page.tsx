"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { db, collection, query, orderBy, getDocs, doc, deleteDoc, writeBatch } from "@/lib/firebase";
import { 
  PlusCircle, 
  Calendar, 
  User, 
  FileSpreadsheet, 
  TrendingUp, 
  CheckCircle2, 
  FileText,
  AlertCircle,
  Trash2,
  AlertTriangle
} from "lucide-react";

interface ReportPeriod {
  id: string;
  title: string;
  quarter: string;
  year: number;
  location: string;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  status: string;
  uploadedFileNames?: string[];
  createdAt: string;
}

export default function ReportPeriods() {
  const [reports, setReports] = useState<ReportPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportToDelete, setReportToDelete] = useState<ReportPeriod | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedReports: ReportPeriod[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedReports.push({
            id: doc.id,
            title: data.title,
            quarter: data.quarter,
            year: data.year,
            location: data.location,
            preparedBy: data.preparedBy,
            checkedBy: data.checkedBy,
            approvedBy: data.approvedBy,
            status: data.status,
            uploadedFileNames: data.uploadedFileNames || [],
            createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : "",
          });
        });
        setReports(fetchedReports);
      } catch (err: any) {
        console.error("Error fetching reports:", err);
        setError("Could not retrieve reports. Please ensure Firestore is enabled in the Firebase Console.");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);

    const reportId = reportToDelete.id;

    // Optimistic UI: remove card immediately so user doesn't wait
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    setReportToDelete(null);

    try {
      // 1. Delete the main report document first to ensure it never reappears in list queries
      await deleteDoc(doc(db, "reports", reportId));

      // Helper: delete all docs in a subcollection using parallel batch commits
      const deleteSubcollection = async (subcollectionName: string) => {
        const colRef = collection(db, "reports", reportId, subcollectionName);
        const snap = await getDocs(colRef);
        if (snap.empty) return;

        const batchPromises: Promise<void>[] = [];
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 450) {
          const batch = writeBatch(db);
          docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
          batchPromises.push(batch.commit());
        }
        await Promise.all(batchPromises);
      };

      // 2. Clean up subcollections in parallel (non-blocking for UI state/parent visibility)
      await Promise.all([
        deleteSubcollection("inventoryItems"),
        deleteSubcollection("agingData"),
      ]);
    } catch (err: any) {
      console.error("Error deleting report:", err);
      setError("Failed to fully delete the report. Some data may remain — please try again.");
      // Re-fetch to restore accurate state on failure
      try {
        const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedReports: ReportPeriod[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedReports.push({
            id: docSnap.id,
            title: data.title,
            quarter: data.quarter,
            year: data.year,
            location: data.location,
            preparedBy: data.preparedBy,
            checkedBy: data.checkedBy,
            approvedBy: data.approvedBy,
            status: data.status,
            uploadedFileNames: data.uploadedFileNames || [],
            createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : "",
          });
        });
        setReports(fetchedReports);
      } catch { /* silent */ }
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
      case "validated":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "generated":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "approved":
        return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
      case "archived":
      case "closed":
        return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Report Periods</h1>
          <p className="mt-1 text-sm text-slate-450">
            Create, manage, and execute quarterly inventory audit cycles.
          </p>
        </div>
        
        <Link
          href="/reports/create"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg shadow-indigo-500/10"
        >
          <PlusCircle className="h-4 w-4" />
          Create Report Period
        </Link>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4 flex gap-3 text-sm text-amber-450">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-400" />
          <div>
            <h4 className="font-semibold text-amber-300">Firestore Connection Note</h4>
            <p className="mt-1 leading-relaxed">
              {error} To continue with offline workflow support or mock testing, verify Firebase configuration.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500"></div>
          <span className="mt-4 text-sm text-slate-400">Loading periods...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/20 py-20 px-4 text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-slate-900 flex items-center justify-center text-slate-450 border border-slate-800">
            <Calendar className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-slate-200">No active report periods</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Begin by creating a new report period session, upload your supplier inventory files, validate the counts, and compile the results.
          </p>
          <div className="mt-6">
            <Link
              href="/reports/create"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-4 py-2 text-xs font-bold text-indigo-400 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Create your first period
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {reports.map((report) => (
            <div 
              key={report.id}
              className="rounded-xl border border-slate-800/80 bg-[#0c0e15]/60 hover:bg-[#0c0e15]/80 transition-all duration-200 p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                      {report.quarter} {report.year}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1 leading-snug">
                      {report.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${getStatusBadge(report.status)}`}>
                      {report.status}
                    </span>
                    <button
                      onClick={() => setReportToDelete(report)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-450 hover:bg-rose-500/5 transition-all duration-150"
                      title="Delete Report"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-y-4 gap-x-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2 text-[13.5px]">
                    <User className="h-4 w-4 text-slate-500 flex-shrink-0" />
                    <span className="truncate">By: {report.preparedBy}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="truncate">{report.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                    <span>{report.uploadedFileNames?.length || 0} files uploaded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                    <span>Created {report.createdAt}</span>
                  </div>
                </div>
              </div>

              {/* Step Navigation based on status */}
              <div className="mt-8 pt-4 border-t border-slate-800/60 flex flex-wrap gap-2 justify-between items-center">
                <Link
                  href={`/reports/${report.id}`}
                  className="inline-flex items-center justify-center rounded-lg border border-indigo-500/25 bg-indigo-500/5 hover:bg-indigo-500/10 px-3.5 py-1.5 text-xs font-bold text-indigo-400 transition-colors"
                >
                  Open Period
                </Link>

                <div className="flex gap-2">
                  {report.status?.toLowerCase() === "draft" && (
                    <>
                      <Link
                        href={`/reports/${report.id}/upload`}
                        className="inline-flex items-center justify-center rounded-lg bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                      >
                        Upload Files
                      </Link>
                      <Link
                        href={`/reports/${report.id}/validate`}
                        className="inline-flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-350 transition-colors"
                      >
                        Validate Rows
                      </Link>
                    </>
                  )}

                  {report.status?.toLowerCase() === "validated" && (
                    <>
                      <Link
                        href={`/reports/${report.id}/dashboard`}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                      >
                        View Dashboard
                      </Link>
                      <Link
                        href={`/reports/${report.id}/builder`}
                        className="inline-flex items-center justify-center rounded-lg bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                      >
                        Build PDF Report
                      </Link>
                      <Link
                        href={`/reports/${report.id}/upload`}
                        className="inline-flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-350 transition-colors"
                      >
                        Reupload
                      </Link>
                    </>
                  )}

                  {(report.status?.toLowerCase() === "generated" || report.status?.toLowerCase() === "approved") && (
                    <>
                      <Link
                        href={`/reports/${report.id}/dashboard`}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                      >
                        Audit Dashboard
                      </Link>
                      <Link
                        href={`/reports/${report.id}/builder`}
                        className="inline-flex items-center justify-center rounded-lg bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                      >
                        Report Builder
                      </Link>
                    </>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {reportToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => !isDeleting && setReportToDelete(null)}
          />
          
          {/* Modal Container */}
          <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl border border-slate-800 bg-[#0c0e14] p-6 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="mx-auto flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 sm:mx-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left space-y-2">
                <h3 className="text-base font-bold text-white leading-6">
                  Delete Report Period
                </h3>
                <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
                  <p>
                    Are you sure that you want to delete this <span className="font-semibold text-rose-400">"{reportToDelete.title}"</span> report?
                  </p>
                  <p className="text-[11px] text-slate-550 leading-relaxed">
                    This will permanently delete the report, all of its metadata, and all uploaded inventory files associated with it. This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setReportToDelete(null)}
                className="inline-flex w-full justify-center rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-850 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteReport}
                className="inline-flex w-full justify-center rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
