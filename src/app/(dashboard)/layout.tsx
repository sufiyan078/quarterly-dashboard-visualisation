"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  LayoutDashboard,
  ClipboardList,
  History,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  FileSpreadsheet,
  User,
  Sun,
  Moon,
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Home", href: "/dashboard", icon: LayoutDashboard },
    { name: "Report Periods", href: "/reports", icon: ClipboardList },
    { name: "Historical Reports", href: "/historical", icon: History },
    { name: "Settings", href: "/settings", icon: SettingsIcon },
  ];

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "auditor":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
    }
  };

  const isLinkActive = (href: string) => {
    if (href === "/dashboard" && pathname === "/dashboard") return true;
    if (href !== "/dashboard" && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <ProtectedRoute>
      <div className="flex flex-col min-h-screen" style={{ background: 'var(--th-app-bg)', color: 'var(--th-text-body)' }}>

        {/* ─── Top Header / Navbar ─── */}
        <header className="sticky top-0 z-30 border-b" style={{ borderColor: 'var(--th-border)', background: 'var(--th-header-bg)', backdropFilter: 'blur(20px)' }}>
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">

              {/* Left: Logo */}
              <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
                <div className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <FileSpreadsheet className="h-4.5 w-4.5 text-white" />
                </div>
                <span className="font-bold tracking-tight text-sm hidden sm:inline" style={{ color: 'var(--th-text-heading)' }}>
                  INVENTORY PORTAL
                </span>
              </Link>

              {/* Center: Navigation pill (desktop) */}
              <nav className="nav-glass-container hidden md:flex items-center gap-1 rounded-full px-1.5 py-1" style={{ border: '1px solid var(--th-nav-pill-border)', background: 'var(--th-nav-pill-bg)' }}>
                {navigation.map((item) => {
                  const active = isLinkActive(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`nav-glass-item flex items-center gap-2 px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 ${
                        active
                          ? "nav-glass-item-active shadow-sm"
                          : "hover:opacity-80"
                      }`}
                      style={active ? {
                        background: 'var(--th-nav-active)',
                        color: 'var(--th-text-heading)',
                      } : {
                        color: 'var(--th-text-muted)',
                      }}
                    >
                      <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              {/* Right: Theme toggle + User info + sign out */}
              <div className="hidden md:flex items-center gap-3">

                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="relative flex items-center justify-center h-8 w-8 rounded-full transition-all duration-300 hover:scale-110"
                  style={{
                    background: theme === 'dark'
                      ? 'rgba(13, 148, 136, 0.15)'
                      : 'rgba(140, 123, 80, 0.15)',
                    border: theme === 'dark'
                      ? '1px solid rgba(13, 148, 136, 0.3)'
                      : '1px solid rgba(140, 123, 80, 0.3)',
                  }}
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  id="theme-toggle-btn"
                >
                  {theme === 'dark' ? (
                    <Sun className="h-3.5 w-3.5 text-amber-400 transition-transform duration-300" />
                  ) : (
                    <Moon className="h-3.5 w-3.5 transition-transform duration-300" style={{ color: '#8c7b50' }} />
                  )}
                </button>

                <div className="flex items-center gap-2.5">
                  {profile?.photoUrl ? (
                    <img
                      src={profile.photoUrl}
                      alt={profile.name}
                      className="h-7 w-7 rounded-full ring-1 ring-slate-700"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full flex items-center justify-center ring-1 ring-[var(--th-border)]" style={{ background: 'var(--th-elevated-bg)' }}>
                      <User className="h-3.5 w-3.5" style={{ color: 'var(--th-text-muted)' }} />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold leading-tight" style={{ color: 'var(--th-text-body)' }}>
                      {profile?.name || "Loading..."}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0 rounded mt-0.5 w-fit ${getRoleColor(profile?.role || "viewer")}`}>
                      {profile?.role || "viewer"}
                    </span>
                  </div>
                </div>

                <div className="w-px h-6" style={{ background: 'var(--th-border)' }} />

                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors p-1.5 rounded-lg hover:bg-red-500/5"
                  style={{ color: 'var(--th-text-faint)' }}
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Mobile: Theme toggle + Hamburger */}
              <div className="md:hidden flex items-center gap-2">
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{
                    background: theme === 'dark' ? 'rgba(13, 148, 136, 0.15)' : 'rgba(140, 123, 80, 0.15)',
                    color: theme === 'dark' ? '#2dd4bf' : '#8c7b50',
                  }}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-1.5 rounded-lg focus:outline-none"
                  style={{ color: 'var(--th-text-muted)' }}
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ─── Mobile Menu Overlay ─── */}
        {mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 backdrop-blur-sm z-40 mt-16"
            style={{ background: 'var(--th-modal-backdrop)' }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="w-72 h-full flex flex-col justify-between py-6 px-4 animate-in slide-in-from-left duration-200"
              style={{ background: 'var(--th-surface-solid)', borderRight: '1px solid var(--th-border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-1">
                {navigation.map((item) => {
                  const active = isLinkActive(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        active
                          ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                          : ""
                      }`}
                      style={!active ? { color: 'var(--th-text-muted)' } : undefined}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              <div className="pt-4" style={{ borderTop: '1px solid var(--th-border)' }}>
                <div className="flex items-center gap-3 mb-3">
                  {profile?.photoUrl ? (
                    <img
                      src={profile.photoUrl}
                      alt={profile.name}
                      className="h-8 w-8 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: 'var(--th-elevated-bg)' }}>
                      <User className="h-4 w-4" style={{ color: 'var(--th-text-muted)' }} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--th-text-body)' }}>
                      {profile?.name}
                    </p>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${getRoleColor(profile?.role || "viewer")}`}>
                      {profile?.role || "viewer"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                  style={{ borderColor: 'var(--th-border)', color: 'var(--th-text-muted)' }}
                >
                  <LogOut className="h-3 w-3" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Main Content Area ─── */}
        <main className="flex-1 p-6 md:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>

      </div>
    </ProtectedRoute>
  );
}
