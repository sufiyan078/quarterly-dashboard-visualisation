"use client";

import React, { useEffect, useState } from "react";
import { db, collection, getDocs, orderBy, query } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Database,
  Calendar,
  Lock,
  CheckCircle2,
  Mail,
  UserCheck,
  Sun,
  Moon,
  Palette,
  Info,
} from "lucide-react";
import packageInfo from "../../../../package.json";


interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoUrl?: string;
  role: string;
  createdAt: any;
  lastLoginAt: any;
}

export default function Settings() {
  const { user, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // System parameters state
  const [complianceThreshold, setComplianceThreshold] = useState("95%");
  const [defaultCurrency, setDefaultCurrency] = useState("USD ($)");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, "users"), orderBy("lastLoginAt", "desc"));
        const snapshot = await getDocs(q);
        const list: UserProfile[] = [];
        snapshot.forEach((doc) => {
          list.push({ uid: doc.id, ...doc.data() } as UserProfile);
        });
        setUsers(list);
      } catch (err: any) {
        console.error("Error retrieving user database list:", err);
        setError("Could not retrieve user profiles. Sign in with an Admin account or check security rules.");
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  return (
    <div className="space-y-8 max-w-5xl animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--th-text-heading)' }}>
          <SettingsIcon className="h-6 w-6 text-indigo-400" />
          Portal Configurations & Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--th-text-muted)' }}>
          Manage system parameters, view registered user roles, and inspect database schemas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: System Config & Profile */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* User Profile Card */}
          <div className="rounded-xl backdrop-blur-md p-6 space-y-5" style={{ border: '1px solid var(--th-border)', background: 'var(--th-surface)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 pb-3" style={{ color: 'var(--th-text-heading)', borderBottom: '1px solid var(--th-border)' }}>
              <User className="h-4 w-4 text-indigo-400" />
              Auditor Profile
            </h3>

            <div className="flex items-center gap-4">
              {profile?.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.name || "Profile"}
                  className="h-16 w-16 rounded-full object-cover"
                  style={{ border: '1px solid var(--th-border)' }}
                />
              ) : (
                <div className="h-16 w-16 rounded-full flex items-center justify-center text-indigo-400 font-bold text-lg" style={{ border: '1px solid var(--th-border)', background: 'var(--th-elevated-bg)' }}>
                  {profile?.name?.charAt(0) || "U"}
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold" style={{ color: 'var(--th-text-body)' }}>{profile?.name || "Active Auditor"}</h4>
                <p className="text-xs mt-0.5" style={{ color: 'var(--th-text-faint)' }}>{profile?.email || user?.email}</p>
                
                <div className="mt-2.5 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                    <Shield className="h-3 w-3" />
                    {profile?.role || "Auditor"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Theme Appearance Card */}
          <div className="rounded-xl backdrop-blur-md p-6 space-y-5" style={{ border: '1px solid var(--th-border)', background: 'var(--th-surface)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 pb-3" style={{ color: 'var(--th-text-heading)', borderBottom: '1px solid var(--th-border)' }}>
              <Palette className="h-4 w-4 text-indigo-400" />
              Appearance
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Dark Mode Option */}
              <button
                onClick={() => setTheme("dark")}
                className={`relative group rounded-xl p-4 transition-all duration-300 cursor-pointer ring-offset-[var(--th-app-bg)] ${
                  theme === "dark" 
                    ? "ring-2 ring-indigo-500 ring-offset-2 shadow-lg shadow-indigo-500/10" 
                    : "hover:scale-[1.02]"
                }`}
                style={{
                  background: theme === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'var(--th-elevated-bg)',
                  border: theme === 'dark' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--th-border)',
                }}
                id="theme-dark-option"
              >
                {/* Mini preview */}
                <div className="rounded-lg overflow-hidden mb-3 border" style={{ borderColor: 'rgba(30, 41, 59, 0.5)' }}>
                  <div className="h-20 bg-[#090b11] p-2">
                    <div className="h-2 w-12 bg-slate-700 rounded mb-1.5"></div>
                    <div className="flex gap-1.5">
                      <div className="h-6 w-1/2 bg-slate-800 rounded"></div>
                      <div className="h-6 w-1/2 bg-slate-800 rounded"></div>
                    </div>
                    <div className="flex gap-1 mt-1.5">
                      <div className="h-1.5 w-8 bg-indigo-500/40 rounded"></div>
                      <div className="h-1.5 w-6 bg-cyan-400/30 rounded"></div>
                      <div className="h-1.5 w-10 bg-pink-500/30 rounded"></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-bold" style={{ color: 'var(--th-text-heading)' }}>Dark Mode</span>
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--th-text-faint)' }}>
                  Deep, immersive dark palette with neon accents
                </p>
                {theme === "dark" && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                  </div>
                )}
              </button>

              {/* Light Mode Option */}
              <button
                onClick={() => setTheme("light")}
                className={`relative group rounded-xl p-4 transition-all duration-300 cursor-pointer ring-offset-[var(--th-app-bg)] ${
                  theme === "light" 
                    ? "ring-2 ring-amber-500 ring-offset-2 shadow-lg shadow-amber-500/10" 
                    : "hover:scale-[1.02]"
                }`}
                style={{
                  background: theme === 'light' ? 'rgba(245, 158, 11, 0.06)' : 'var(--th-elevated-bg)',
                  border: theme === 'light' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--th-border)',
                }}
                id="theme-light-option"
              >
                {/* Mini preview */}
                <div className="rounded-lg overflow-hidden mb-3 border" style={{ borderColor: 'rgba(195, 185, 130, 0.4)' }}>
                  <div className="h-20 p-2" style={{ background: '#fdf8e1' }}>
                    <div className="h-2 w-12 rounded mb-1.5" style={{ background: '#e0d8a8' }}></div>
                    <div className="flex gap-1.5">
                      <div className="h-6 w-1/2 rounded" style={{ background: '#fffef2' }}></div>
                      <div className="h-6 w-1/2 rounded" style={{ background: '#fffef2' }}></div>
                    </div>
                    <div className="flex gap-1 mt-1.5">
                      <div className="h-1.5 w-8 bg-indigo-500/30 rounded"></div>
                      <div className="h-1.5 w-6 bg-emerald-500/30 rounded"></div>
                      <div className="h-1.5 w-10 bg-amber-500/30 rounded"></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold" style={{ color: 'var(--th-text-heading)' }}>Light Mode</span>
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--th-text-faint)' }}>
                  Warm cream palette, easy on the eyes
                </p>
                {theme === "light" && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Compliance Parameters Config */}
          <div className="rounded-xl backdrop-blur-md p-6 space-y-5" style={{ border: '1px solid var(--th-border)', background: 'var(--th-surface)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 pb-3" style={{ color: 'var(--th-text-heading)', borderBottom: '1px solid var(--th-border)' }}>
              <Database className="h-4 w-4 text-indigo-400" />
              Reconciliation Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold" style={{ color: 'var(--th-text-muted)' }}>
                  Compliance Accuracy Target
                </label>
                <select
                  value={complianceThreshold}
                  onChange={(e) => setComplianceThreshold(e.target.value)}
                  className="mt-2 block w-full rounded-lg text-xs px-3 py-2 outline-none transition-colors"
                  style={{ background: 'var(--th-input-bg)', border: '1px solid var(--th-border)', color: 'var(--th-text-heading)' }}
                >
                  <option value="98%">98% accuracy (Strict)</option>
                  <option value="95%">95% accuracy (Standard)</option>
                  <option value="90%">90% accuracy (Relaxed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold" style={{ color: 'var(--th-text-muted)' }}>
                  Currency Units
                </label>
                <select
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                  className="mt-2 block w-full rounded-lg text-xs px-3 py-2 outline-none transition-colors"
                  style={{ background: 'var(--th-input-bg)', border: '1px solid var(--th-border)', color: 'var(--th-text-heading)' }}
                >
                  <option value="USD ($)">USD ($) - US Dollar</option>
                  <option value="AED (AED)">AED (AED) - UAE Dirham</option>
                  <option value="EUR (€)">EUR (€) - Euro</option>
                </select>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Registered User Accounts list */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl p-6 flex flex-col h-full min-h-[350px]" style={{ border: '1px solid var(--th-border)', background: 'var(--th-surface)' }}>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider pb-3 flex items-center gap-2" style={{ color: 'var(--th-text-heading)', borderBottom: '1px solid var(--th-border)' }}>
                <UserCheck className="h-4 w-4 text-indigo-400" />
                Registered Portals ({users.length})
              </h3>

              {error && (
                <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-[11px] text-red-400">
                  {error}
                </div>
              )}

              {loadingUsers ? (
                <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--th-text-faint)' }}>
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-indigo-500 mb-2" style={{ borderColor: 'var(--th-spinner-track)', borderTopColor: '#6366f1' }}></div>
                  <span className="text-[11px]">Loading user roster...</span>
                </div>
              ) : (
                <ul className="mt-4 space-y-3.5 overflow-y-auto max-h-[300px] pr-1.5">
                  {users.map((u) => (
                    <li
                      key={u.uid}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg text-xs"
                      style={{ background: 'var(--th-input-bg)', border: '1px solid var(--th-border)' }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {u.photoUrl ? (
                          <img
                            src={u.photoUrl}
                            alt={u.name}
                            className="h-7 w-7 rounded-full object-cover"
                            style={{ border: '1px solid var(--th-border)' }}
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full flex items-center justify-center font-bold text-indigo-400" style={{ background: 'var(--th-elevated-bg)', border: '1px solid var(--th-border)' }}>
                            {u.name?.charAt(0) || "U"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: 'var(--th-text-body)' }}>{u.name || "Anonymous User"}</p>
                          <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--th-text-faint)' }}>{u.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0 text-right">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-400 uppercase">
                          {u.role || "Auditor"}
                        </span>
                        <p className="text-[8px] mt-1 font-mono" style={{ color: 'var(--th-text-faint)' }}>
                          {u.lastLoginAt?.toDate
                            ? u.lastLoginAt.toDate().toLocaleDateString()
                            : "Recent"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* System Information Card */}
          <div className="rounded-xl backdrop-blur-md p-6 space-y-4" style={{ border: '1px solid var(--th-border)', background: 'var(--th-surface)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 pb-3" style={{ color: 'var(--th-text-heading)', borderBottom: '1px solid var(--th-border)' }}>
              <Info className="h-4 w-4 text-indigo-400" />
              System Information
            </h3>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--th-text-muted)' }}>Software Version</span>
                <span className="font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  v{packageInfo.version}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--th-text-muted)' }}>Status</span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--th-text-muted)' }}>Environment</span>
                <span className="font-semibold" style={{ color: 'var(--th-text-body)' }}>Production (Baseline)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--th-text-muted)' }}>Database</span>
                <span className="font-semibold text-indigo-400">Cloud Firestore (Spark)</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
