"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  UploadCloud, 
  CheckCircle2, 
  LayoutDashboard, 
  FileText, 
  FileDown,
  Play,
  Pause
} from "lucide-react";

export default function HomeDashboard() {
  const { profile } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const steps = [
    {
      title: "Upload Data",
      icon: UploadCloud,
      desc: "Ingest supplier Excel spreadsheets client-side. No raw records are transmitted to the cloud, guaranteeing absolute data confidentiality.",
      badge: "In-Browser",
      color: "from-blue-500 to-indigo-500",
      glowColor: "rgba(59, 130, 246, 0.4)"
    },
    {
      title: "Validate Date",
      icon: CheckCircle2,
      desc: "Run deterministic discrepancy calculations, check matching ratios, and flag inventory variance risk automatically.",
      badge: "Real-Time QA",
      color: "from-indigo-500 to-purple-500",
      glowColor: "rgba(99, 102, 241, 0.4)"
    },
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      desc: "Visualize overall valuation profiles, inventory shortage/excess metrics, and item classifications via live interactive analytics.",
      badge: "Interactive",
      color: "from-purple-500 to-pink-500",
      glowColor: "rgba(168, 85, 247, 0.4)"
    },
    {
      title: "Pre-Report",
      icon: FileText,
      desc: "Formulate professional consulting narratives, audit commentaries, and perform checklist-gated automated QA validation.",
      badge: "Audit Gates",
      color: "from-pink-500 to-rose-500",
      glowColor: "rgba(236, 72, 153, 0.4)"
    },
    {
      title: "Report",
      icon: FileDown,
      desc: "Compile corporate-themed A4 PDF reports with automated table of contents, signed-off checklist, and local downloads.",
      badge: "PDF Export",
      color: "from-rose-500 to-emerald-500",
      glowColor: "rgba(244, 63, 94, 0.4)"
    }
  ];

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

        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Inventory Audit Pipeline
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              End-to-end flow of the quarterly dashboard visualization portal.
            </p>
          </div>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 transition-all duration-200 cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>Pause Autoplay</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                <span>Autoplay</span>
              </>
            )}
          </button>
        </div>

        {/* Workflow steps */}
        <div className="relative">
          {/* Connection line track background */}
          <div className="absolute top-7 left-8 right-8 h-1 bg-slate-800/60 rounded-full -z-10 hidden md:block"></div>
          
          {/* Animated active connection line */}
          <div 
            className="absolute top-7 left-8 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full -z-10 hidden md:block transition-all duration-1000 ease-in-out"
            style={{ width: `${activeStep * 22.5}%` }}
          ></div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-4">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === activeStep;
              const isCompleted = idx < activeStep;
              
              return (
                <div 
                  key={idx}
                  onClick={() => {
                    setActiveStep(idx);
                    setIsPlaying(false);
                  }}
                  className={`group flex flex-row md:flex-col items-center gap-4 md:gap-3 p-3 md:p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                    isActive 
                      ? "bg-slate-900/50 border border-slate-700/80 shadow-lg" 
                      : "bg-transparent border border-transparent hover:bg-slate-900/20"
                  }`}
                >
                  {/* Step bubble */}
                  <div 
                    className={`h-14 w-14 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                      isActive 
                        ? `bg-gradient-to-br ${step.color} text-white border-transparent` 
                        : isCompleted 
                        ? "bg-slate-900 text-indigo-400 border-indigo-500/50" 
                        : "bg-slate-950 text-slate-500 border-slate-800"
                    }`}
                    style={isActive ? { boxShadow: `0 0 20px ${step.glowColor}` } : {}}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  {/* Step info */}
                  <div className="flex-1 md:text-center min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">
                      Stage 0{idx + 1}
                    </span>
                    <h4 className={`text-sm font-semibold truncate transition-colors duration-300 ${
                      isActive ? "text-white" : "text-slate-300 group-hover:text-white"
                    }`}>
                      {step.title}
                    </h4>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed focused step card */}
        <div className="mt-8 p-5 rounded-xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-sm relative overflow-hidden transition-all duration-500">
          <div className="absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl"></div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full bg-gradient-to-r ${steps[activeStep].color} animate-pulse`}></span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Workflow Details
              </span>
            </div>
            <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20 w-fit">
              {steps[activeStep].badge}
            </span>
          </div>

          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            {steps[activeStep].title}
          </h3>
          
          <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
            {steps[activeStep].desc}
          </p>
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
