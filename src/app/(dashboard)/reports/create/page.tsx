"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db, doc, setDoc, collection } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Save } from "lucide-react";

export default function CreateReport() {
  const router = useRouter();
  const { profile } = useAuth();

  const [formData, setFormData] = useState({
    title: "",
    preparedBy: profile?.name || "",
    checkedBy: "",
    approvedBy: "",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.preparedBy) {
      setError("Please fill out all required fields (Title and Prepared By).");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newDocRef = doc(collection(db, "reports"));
      const reportId = newDocRef.id;

      await setDoc(newDocRef, {
        reportId,
        ...formData,
        status: "Draft",
        uploadedFileNames: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: profile?.uid || "anonymous",
      });

      router.push(`/reports/${reportId}/upload`);
    } catch (err: any) {
      console.error("Error creating report period:", err);
      setError("Failed to create report period. Make sure your Firestore rules allow writes and you are logged in.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-in fade-in duration-300">

      {/* Card */}
      <div className="w-full max-w-xl space-y-6">

        {/* Back button & Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/reports"
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Create Report Period</h1>
            <p className="mt-1 text-sm text-slate-450">
              Configure the metadata and audit signatories to initiate an inventory reconciliation.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Configuration Form */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800/80 bg-[#0c0e15]/60 backdrop-blur-md p-6 sm:p-8 space-y-6">

          {/* Section 1: Basic Metadata */}
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Audit Metadata</h3>

            <div>
              <label htmlFor="title" className="block text-xs font-semibold text-slate-300">
                Report Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="title"
                id="title"
                required
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Q1 2026 Warehouse Discrepancy Reconciliation"
                className="mt-2 block w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-white px-3.5 py-2.5 placeholder-slate-600 outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-xs font-semibold text-slate-300">
                Notes
              </label>
              <textarea
                name="notes"
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Enter additional audit notes or context..."
                className="mt-2 block w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-white px-3.5 py-2.5 placeholder-slate-600 outline-none transition-colors resize-none"
              />
            </div>
          </div>

          <div className="border-t border-slate-800/40" />

          {/* Section 2: Audit Signatories */}
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Audit Signatories</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="preparedBy" className="block text-xs font-semibold text-slate-300">
                  Prepared By <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="preparedBy"
                  id="preparedBy"
                  required
                  value={formData.preparedBy}
                  onChange={handleChange}
                  placeholder="Enter Auditor Name"
                  className="mt-2 block w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-white px-3.5 py-2.5 placeholder-slate-600 outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="checkedBy" className="block text-xs font-semibold text-slate-300">
                  Checked By
                </label>
                <input
                  type="text"
                  name="checkedBy"
                  id="checkedBy"
                  value={formData.checkedBy}
                  onChange={handleChange}
                  placeholder="Enter Supervisor Name"
                  className="mt-2 block w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-white px-3.5 py-2.5 placeholder-slate-600 outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="approvedBy" className="block text-xs font-semibold text-slate-300">
                  Approved By
                </label>
                <input
                  type="text"
                  name="approvedBy"
                  id="approvedBy"
                  value={formData.approvedBy}
                  onChange={handleChange}
                  placeholder="Enter Manager Name"
                  className="mt-2 block w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-white px-3.5 py-2.5 placeholder-slate-600 outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800/40 mt-2">
            <Link
              href="/reports"
              className="inline-flex items-center justify-center rounded-lg border border-slate-800 hover:bg-slate-800/30 hover:text-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-650 px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg shadow-indigo-500/10 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save & Continue
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
