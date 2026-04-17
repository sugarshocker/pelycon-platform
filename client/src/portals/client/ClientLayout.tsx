import { useState } from "react";
import { useLocation } from "wouter";
import type { AuthUser } from "@/lib/queryClient";
import { clearToken, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Ticket,
  Receipt,
  FileText,
  ShieldCheck,
  Monitor,
  TrendingUp,
  BookOpen,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import pelyconLogo from "@assets/Pelycon_Logomark_RGB_Orange_1770825725925.png";

const PORTAL_NAV = [
  { title: "Dashboard", path: "/portal", icon: LayoutDashboard, exact: true },
  { title: "Tickets", path: "/portal/tickets", icon: Ticket },
  { title: "Invoices", path: "/portal/invoices", icon: Receipt },
  { title: "Agreements", path: "/portal/agreements", icon: FileText },
  { title: "Security", path: "/portal/security", icon: ShieldCheck },
  { title: "Assets", path: "/portal/assets", icon: Monitor },
  { title: "Trends", path: "/portal/trends", icon: TrendingUp },
  { title: "Knowledge Base", path: "/portal/kb", icon: BookOpen },
];

interface Props {
  user: AuthUser;
  onLogout: () => void;
  children: React.ReactNode;
}

export function ClientLayout({ user, onLogout, children }: Props) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try { await apiRequest("POST", "/api/auth/logout"); } catch {}
    clearToken();
    onLogout();
  };

  const isActive = (item: typeof PORTAL_NAV[0]) =>
    item.exact ? location === item.path : location.startsWith(item.path);

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 px-3">
      {PORTAL_NAV.map(item => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <button
            key={item.path}
            onClick={() => { setLocation(item.path); setMobileOpen(false); }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
              active
                ? "bg-[#E77125] text-white"
                : "text-[#394442]/70 hover:bg-[#394442]/10 hover:text-[#394442]"
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {item.title}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200 dark:border-gray-800">
          <img src={pelyconLogo} alt="Pelycon" className="h-8 w-8 object-contain flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-[#394442] dark:text-white leading-tight">Pelycon Technologies</div>
            <div className="text-[10px] text-[#394442]/50 uppercase tracking-widest">Client Portal</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks />
        </div>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <div className="text-xs font-medium text-[#394442] dark:text-white truncate">{user.displayName}</div>
          <div className="text-[10px] text-[#394442]/50 truncate mb-2">{user.email}</div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2 h-8 text-xs text-[#394442]/60">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-white dark:bg-gray-900 h-full">
            <div className="flex items-center justify-between px-4 py-4 border-b">
              <img src={pelyconLogo} alt="Pelycon" className="h-7 w-7 object-contain" />
              <button onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-4"><NavLinks /></div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 lg:hidden">
          <button onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <img src={pelyconLogo} alt="Pelycon" className="h-6 w-6 object-contain" />
          <span className="text-sm font-semibold text-[#394442] dark:text-white">Client Portal</span>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
