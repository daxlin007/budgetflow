"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "../lib/supabase-browser";
import { getProfile } from "../lib/db";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "▣", href: "/dashboard" },
  { id: "budget", label: "Budget", icon: "◉", href: "/budget" },
  { id: "history", label: "History", icon: "☰", href: "/history" },
  { id: "setup", label: "Setup", icon: "⚙", href: "/setup" },
];

export default function DashboardLayout({ children }) {
  const [profile, setProfile] = useState(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    getProfile().then(setProfile).catch(console.error);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const activeTab = NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.id || "dashboard";

  return (
    <div className="min-h-screen bg-bf-bg text-bf-text font-sans">
      {/* Top Nav */}
      <div className="h-[52px] px-4 flex items-center justify-between border-b border-white/[0.07] bg-bf-bg/95 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-gradient-to-br from-bf-accent to-emerald-600 flex items-center justify-center text-xs font-bold text-bf-bg">
            B
          </div>
          <span className="text-[15px] font-bold tracking-tight">
            budget<span className="text-bf-accent">flow</span>
          </span>
        </div>

        <div className="flex gap-0.5 items-center">
          {NAV_ITEMS.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(t.href)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === t.id
                  ? "bg-bf-accent/10 border border-bf-accent/20 text-bf-accent"
                  : "border border-transparent text-bf-dim hover:text-bf-text"
              }`}
            >
              <span className="text-[9px]">{t.icon}</span> {t.label}
            </button>
          ))}

          <div className="w-px h-5 bg-white/[0.07] mx-1.5" />

          <div className="flex items-center gap-2">
            <div className="w-[26px] h-[26px] rounded-lg bg-bf-accent/10 border border-bf-accent/20 flex items-center justify-center text-[11px] font-bold text-bf-accent">
              {(profile?.name || "U").charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-bf-dim max-w-[80px] truncate">
              {profile?.name?.split(" ")[0] || "User"}
            </span>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="bg-transparent border-none text-white/20 cursor-pointer text-sm px-1 hover:text-white/50 transition"
            >
              ⏻
            </button>
          </div>
        </div>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
