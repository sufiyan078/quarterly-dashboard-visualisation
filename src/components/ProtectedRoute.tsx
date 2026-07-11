"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
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

  return <>{children}</>;
};
