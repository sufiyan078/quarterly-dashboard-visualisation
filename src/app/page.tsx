"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center" style={{ background: 'var(--th-app-bg)', color: 'var(--th-text-heading)' }}>
      <div className="relative flex flex-col items-center">
        <div className="absolute -inset-10 rounded-full bg-indigo-500/10 blur-xl"></div>
        <div className="relative h-16 w-16 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500"></div>
        <h2 className="mt-8 text-lg font-medium tracking-wide text-slate-300">
          Inventory Analytics & Reporting
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Initializing portal routing...
        </p>
      </div>
    </div>
  );
}
