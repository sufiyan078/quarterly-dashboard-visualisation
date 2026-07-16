"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading, isApproved, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.push("/login");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090b11] text-white">
        <div className="relative flex flex-col items-center">
          {/* Decorative glowing background */}
          <div className="absolute -inset-10 rounded-full bg-indigo-500/10 blur-xl"></div>
          
          {/* Animated Spinner */}
          <div className="relative h-16 w-16 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500"></div>
          
          <h2 className="mt-8 text-lg font-medium tracking-wide text-slate-300">
            Inventory Analytics & Reporting
          </h2>
          <p className="mt-2 text-sm text-slate-500 animate-pulse">
            Verifying secure session...
          </p>
        </div>
      </div>
    );
  }

  // If not logged in and not on login page, render nothing while redirecting
  if (!user && pathname !== "/login") {
    return null;
  }

  // Approval gate: signed-in accounts that have not been approved by an
  // administrator may not use the application at all.
  if (user && profile && !isApproved && pathname !== "/login") {
    const rejected = profile.status === "rejected";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090b11] text-white px-6">
        <div className="max-w-md w-full rounded-xl border border-slate-800 bg-slate-950/40 p-8 text-center">
          <div className={`mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full ${rejected ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"}`}>
            <span className="text-xl">{rejected ? "✕" : "⏳"}</span>
          </div>
          <h2 className="text-lg font-bold text-white">
            {rejected ? "Access Request Rejected" : "Your account is awaiting administrator approval."}
          </h2>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">
            {rejected
              ? "An administrator has declined your access request. Contact your system administrator if you believe this is a mistake."
              : `Your sign-in request (${profile.email}) has been recorded. An administrator must approve it before you can use the Inventory Analytics Portal.`}
          </p>
          <button
            onClick={() => logout()}
            className="mt-6 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
