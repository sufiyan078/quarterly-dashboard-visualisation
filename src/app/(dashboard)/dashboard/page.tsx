"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import DemoOne from "@/components/ui/morphing-card-stack-demo";

export default function HomeDashboard() {
  const { profile } = useAuth();

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

      {/* Audit Logs / Activity */}
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

    </div>
  );
}
