import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  LineChart,
  Bookmark,
  BellRing,
  Users,
  BookOpen,
  WalletCards,
  GraduationCap,
  BrainCircuit,
  History,
  ClipboardCheck,
  Settings,
  LogOut,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import MobileInstallPrompt from "@/components/MobileInstallPrompt";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/markets", label: "Markets", icon: LineChart, testid: "nav-markets" },
  { to: "/watchlists", label: "Watchlists", icon: Bookmark, testid: "nav-watchlists" },
  { to: "/alerts", label: "Alerts", icon: BellRing, testid: "nav-alerts" },
  { to: "/social", label: "Social", icon: Users, testid: "nav-social" },
  { to: "/journal", label: "Journal", icon: BookOpen, testid: "nav-journal" },
  { to: "/payout-tracker", label: "Payout Tracker", icon: WalletCards, testid: "nav-payout-tracker" },
  { to: "/education", label: "Education", icon: GraduationCap, testid: "nav-education" },
  { to: "/pbm-brain", label: "PBM Brain", icon: BrainCircuit, testid: "nav-pbm-brain" },
  { to: "/ai-teaching", label: "AI Teaching", icon: ClipboardCheck, testid: "nav-ai-teaching", adminOnly: true },
  { to: "/history", label: "AI History", icon: History, testid: "nav-history" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings", adminOnly: true },
];

export default function Layout({ children }) {
  const { user, signOut, displayName, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems = useMemo(() => NAV.filter((item) => !item.adminOnly || isAdmin), [isAdmin]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-64 border-r border-zinc-200 bg-white z-40 flex-col">
        <div className="px-6 py-6 border-b border-zinc-200">
          <Link to="/" className="flex items-center gap-2.5" data-testid="brand-link">
            <div className="w-8 h-8 rounded-md bg-zinc-950 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-heading text-base font-extrabold tracking-tight text-zinc-950 leading-none">
                PBM
              </div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-zinc-500 mt-1">
                AI Trading
              </div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-100 text-zinc-950"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`
              }
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-zinc-200">
          <div className="px-3 py-2 mb-2">
            <div className="text-[11px] tracking-[0.1em] uppercase text-zinc-400 font-semibold">
              Signed in as
            </div>
            <div className="text-xs text-zinc-700 mt-0.5 truncate" data-testid="user-email">
              {displayName || user?.email}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            data-testid="sign-out-btn"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
          Sign out
          </button>
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-zinc-200">
        <div className="h-16 px-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" data-testid="mobile-brand-link">
            <div className="w-8 h-8 rounded-md bg-zinc-950 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-heading text-base font-extrabold tracking-tight text-zinc-950 leading-none">
                PBM
              </div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-zinc-500 mt-1">
                AI Trading
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="w-10 h-10 inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-900 active:bg-zinc-100 transition-colors"
            aria-label="Open menu"
            data-testid="mobile-menu-open"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-200 ${
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-zinc-950/30"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        />
        <div
          className={`absolute left-0 right-0 bottom-0 bg-white border-t border-zinc-200 rounded-t-lg shadow-2xl transition-transform duration-300 ease-out ${
            mobileMenuOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="px-5 pt-3 pb-4 border-b border-zinc-100">
            <div className="mx-auto w-10 h-1 rounded-full bg-zinc-200 mb-4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-zinc-950 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
                </div>
                <div>
                  <div className="font-heading text-base font-extrabold tracking-tight text-zinc-950 leading-none">
                    PBM
                  </div>
                  <div className="text-[10px] tracking-[0.18em] uppercase text-zinc-500 mt-1">
                    AI Trading
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 active:bg-zinc-100 transition-colors"
                aria-label="Close menu"
                data-testid="mobile-menu-close"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <nav className="px-3 py-4 grid grid-cols-2 gap-1 max-h-[58vh] overflow-y-auto">
            {navItems.map(({ to, label, icon: Icon, testid }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                data-testid={`mobile-${testid}`}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-zinc-100 text-zinc-950"
                      : "text-zinc-600 active:bg-zinc-50"
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="px-3 py-4 border-t border-zinc-200 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <div className="px-3 py-2 mb-2">
              <div className="text-[11px] tracking-[0.1em] uppercase text-zinc-400 font-semibold">
                Signed in as
              </div>
              <div className="text-xs text-zinc-700 mt-0.5 truncate">
                {displayName || user?.email}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              data-testid="mobile-sign-out-btn"
              className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-zinc-600 active:bg-zinc-50 transition-colors"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </div>
      </div>

      <MobileInstallPrompt />

      <main className="md:ml-64 min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 py-5 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
