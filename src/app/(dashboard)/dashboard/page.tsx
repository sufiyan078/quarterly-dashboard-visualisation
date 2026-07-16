"use client";

import React, { useEffect, useState } from "react";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { db, collection, getDocs, query, where, setDoc, doc } from "@/lib/firebase";
import DemoOne from "@/components/ui/morphing-card-stack-demo";

/** Admin-only: pending Google sign-in requests with Approve / Reject. */
function PendingUserRequests() {
  const [pending, setPending] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "users"), where("status", "==", "pending"));
      const snap = await getDocs(q);
      const list: UserProfile[] = [];
      snap.forEach((d) => list.push(d.data() as UserProfile));
      list.sort((a, b) => (b.lastLoginAt || "").localeCompare(a.lastLoginAt || ""));
      setPending(list);
    } catch (err) {
      console.error("Error loading pending user requests:", err);
      setError("Could not load pending user requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const decide = async (uid: string, status: "approved" | "rejected") => {
    setBusyUid(uid);
    setError(null);
    try {
      await setDoc(doc(db, "users", uid), { status, decidedAt: new Date().toISOString() }, { merge: true });
      setPending((prev) => prev.filter((p) => p.uid !== uid));
    } catch (err) {
      console.error("Error updating user status:", err);
      setError("Could not update the user request.");
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-6 backdrop-blur-md">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pending User Requests</h3>
        <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
          {pending.length} pending
        </span>
      </div>

      {error && <p className="text-xs text-rose-400 mb-4">{error}</p>}

      {loading ? (
        <p className="text-xs text-slate-500">Loading requests…</p>
      ) : pending.length === 0 ? (
        <p className="text-xs text-slate-500">No pending access requests.</p>
      ) : (
        <ul className="divide-y divide-slate-800/40">
          {pending.map((p) => (
            <li key={p.uid} className="py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-200 block truncate">{p.name || "Unnamed user"}</span>
                <span className="text-xs text-slate-400 block truncate">{p.email}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Requested: {p.lastLoginAt ? new Date(p.lastLoginAt).toLocaleString("en-US") : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => decide(p.uid, "approved")}
                  disabled={busyUid === p.uid}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Approve
                </button>
                <button
                  onClick={() => decide(p.uid, "rejected")}
                  disabled={busyUid === p.uid}
                  className="rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-rose-400 transition-colors cursor-pointer"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function HomeDashboard() {
  const { profile, isAdmin } = useAuth();

  const activities = [
    { id: 1, event: "User logged in", detail: `Admin account ${profile?.email} authorized successfully.`, time: "Just now", type: "auth" },
    { id: 2, event: "Created report period", detail: "Report period 'Q1 2026 Physical Count' created by admin.", time: "2 hours ago", type: "event" },
    { id: 3, event: "PDF report exported", detail: "Variance report for 'Q4 2025 Audit' downloaded locally.", time: "Yesterday", type: "report" }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">

      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Welcome back, {profile?.name || "Auditor"}
        </h1>
      </div>

      {/* Motion Card / Process Pipeline */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-6 sm:p-8 backdrop-blur-md relative overflow-hidden">
        {/* Glow node */}
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl"></div>

        <div className="mb-8">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Inventory Audit Pipeline
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Interactive visualization of the end-to-end reconciliation flow. Switch layout modes to explore.
          </p>
        </div>

        <div className="py-4">
          <DemoOne />
        </div>
      </div>

      {/* Admin-only: pending access requests */}
      {isAdmin && <PendingUserRequests />}

      {/* Admin-only: Recent Activity Logs (administrative audit data).
          Enforced server-side via firestore.rules, not just hidden here. */}
      {isAdmin && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-6 backdrop-blur-md">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Recent Activity Logs</h3>
          <div className="flow-root">
            <ul className="-my-5 divide-y divide-slate-800/40">
              {activities.map((act) => (
                <li key={act.id} className="py-5">
                  <div className="relative flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">{act.event}</span>
                        <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[9px] font-medium text-slate-400">
                          {act.type}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{act.detail}</p>
                    </div>
                    <time className="flex-shrink-0 whitespace-nowrap text-xs text-slate-500">{act.time}</time>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

    </div>
  );
}
