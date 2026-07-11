"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { user, loginWithGoogle, loginWithMock, loading } = useAuth();
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await loginWithGoogle();
      router.replace("/dashboard");
    } catch (error: any) {
      console.error(error);
      setAuthError(
        error.message || "Failed to sign in. Please verify your Google account."
      );
      setIsSigningIn(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center" style={{ background: 'var(--th-app-bg)', color: 'var(--th-text-heading)' }}>
        <div className="relative flex flex-col items-center">
          <div className="absolute -inset-10 rounded-full bg-indigo-500/10 blur-xl"></div>
          <div className="relative h-16 w-16 animate-spin rounded-full border-4 border-slate-800 border-t-indigo-500"></div>
          <h2 className="mt-8 text-lg font-medium tracking-wide text-slate-300">
            Inventory Analytics & Reporting
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Checking session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8" style={{ background: 'var(--th-app-bg)' }}>
      {/* Decorative gradient blur nodes */}
      <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl"></div>
      <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-purple-600/20 blur-3xl"></div>
      
      {/* Radial grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]" 
        style={{
          backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`,
          backgroundSize: "24px 24px"
        }}
      ></div>

      <div className="relative w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-0 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Left Side: Brand & Value Prop */}
        <div className="col-span-1 md:col-span-7 p-8 sm:p-12 flex flex-col justify-between bg-gradient-to-br from-indigo-950/50 to-slate-950/70 border-b md:border-b-0 md:border-r border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                INVENTORY ANALYTICS
              </span>
            </div>
            
            <h1 className="mt-12 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Quarterly Audit <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Reports</span> Simplified.
            </h1>
            <p className="mt-4 text-base text-slate-400 max-w-md">
              A high-precision local data ingestion engine. Compile, validate, and report discrepancies inside browser memory with absolute zero cloud leakage.
            </p>
          </div>

          <div className="mt-12 space-y-6">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Local Excel Processing</h4>
                <p className="text-xs text-slate-400 mt-0.5">Parse multi-supplier spreadsheets entirely client-side without storing raw bytes.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Discrepancy Engine</h4>
                <p className="text-xs text-slate-400 mt-0.5">Auto-calculate variances, shortage, excess values, and match ratios in seconds.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Zero Cloud Storage Cost</h4>
                <p className="text-xs text-slate-400 mt-0.5">Runs on free tier using Firestore for summaries and local downloads for PDF reports.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/40 text-xs text-slate-500">
            Powered by Firebase Auth & Firestore on Spark Tier.
          </div>
        </div>

        {/* Right Side: Sign In Form */}
        <div className="col-span-1 md:col-span-5 p-8 sm:p-12 flex flex-col justify-center bg-slate-900/20">
          <div className="w-full">
            <h2 className="text-xl font-bold tracking-tight text-white">
              System Authentication
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Access the inventory portal via your company credentials.
            </p>

            {authError && (
              <div className="mt-6 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                {authError}
              </div>
            )}

            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="group relative flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:bg-slate-100 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSigningIn ? (
                  <svg className="h-5 w-5 animate-spin text-slate-900" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Sign in with Google</span>
              </button>

              <button
                type="button"
                id="bypass-auth-btn"
                onClick={async () => {
                  setAuthError(null);
                  setIsSigningIn(true);
                  try {
                    await loginWithMock();
                    router.replace("/dashboard");
                  } catch (e: any) {
                    setAuthError(e.message || "Bypass failed.");
                    setIsSigningIn(false);
                  }
                }}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-200 px-4 py-3 text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <span>Bypass Auth (Dev Mode)</span>
              </button>
            </div>

            <div className="mt-8 text-center">
              <span className="text-xs text-slate-500">
                Access authorized to internal audit personnel only. Logins are logged and audited.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
