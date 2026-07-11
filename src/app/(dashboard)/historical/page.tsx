"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { db, collection, query, where, getDocs, orderBy } from "@/lib/firebase";
import { 
  History, 
  Search, 
  Calendar, 
  MapPin, 
  FileCheck,
  ChevronRight,
  Archive,
  ArrowRight
} from "lucide-react";

interface Report {
  id: string;
  title: string;
  quarter: string;
  year: number;
  location: string;
  status: string;
  preparedBy: string;
  createdAt: any;
  updatedAt: any;
}

export default function HistoricalReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistorical = async () => {
      try {
        const q = query(
          collection(db, "reports"),
          where("status", "==", "closed")
        );
        const querySnapshot = await getDocs(q);
        const list: Report[] = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Report);
        });
        // Sort client-side by updatedAt descending
        list.sort((a, b) => {
          const getVal = (obj: any) => {
            if (!obj) return 0;
            if (obj.seconds) return obj.seconds;
            if (obj.toDate) return obj.toDate().getTime();
            return new Date(obj).getTime() || 0;
          };
          return getVal(b.updatedAt) - getVal(a.updatedAt);
        });
        setReports(list);
      } catch (err: any) {
        console.error("Error retrieving historical records:", err);
        setError("Unable to retrieve historical audit archives. Check your connection or Firestore setup.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistorical();
  }, []);

  const filteredReports = reports.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ background: 'var(--th-app-bg)' }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500"></div>
        <span className="mt-4 text-sm text-slate-400">Loading historical archives...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <History className="h-6 w-6 text-indigo-400" />
            Historical Audit Archives
          </h1>
          <p className="mt-1 text-sm text-slate-450">
            Access, view, and print finalized, signed, and closed inventory reconciliation records.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Search by title or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full rounded-lg bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs text-white pl-10 pr-4 py-2.5 outline-none transition-colors"
        />
      </div>

      {/* Audit List */}
      {filteredReports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-[#0c0e15]/30 p-12 text-center flex flex-col items-center justify-center space-y-4">
          <Archive className="h-10 w-10 text-slate-500 opacity-40" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-350">No Historical Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Only inventory cycles that have been completed and marked as "Completed & Closed" in the Report Builder will be archived here.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#0c0e15]/40 backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="p-4">Reconciliation Cycle</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Prepared By</th>
                  <th className="p-4">Completed Date</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-slate-300">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-900/10 group">
                    <td className="p-4">
                      <div className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                        {report.title}
                      </div>
                      <div className="text-[10px] text-indigo-400 font-semibold mt-0.5">
                        {report.quarter} {report.year} Cycle
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-slate-350">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        {report.location}
                      </div>
                    </td>
                    <td className="p-4 text-slate-400">{report.preparedBy}</td>
                    <td className="p-4 font-mono text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        {report.updatedAt?.toDate
                          ? report.updatedAt.toDate().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                          : new Date().toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-400 uppercase">
                        <FileCheck className="h-3 w-3 text-slate-500" />
                        Closed
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/reports/${report.id}/builder`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-white transition-colors"
                      >
                        View Report
                        <ArrowRight className="h-3 w-3 transform group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
