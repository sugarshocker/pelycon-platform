import { useState, useEffect, createContext, useContext } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, getToken, clearToken, apiRequest, getStoredUser, setStoredUser } from "./lib/queryClient";
import type { AuthUser } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import {
  SidebarProvider,
  SidebarTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FilePen,
  ClipboardList,
  Users,
  Sun,
  Moon,
  LogOut,
  Building2,
  Receipt,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Tracker from "@/pages/tracker";
import Staging from "@/pages/staging";
import UserManagement from "@/pages/user-management";
import Clients from "@/pages/clients";
import Receivables from "@/pages/receivables";
import Sales from "@/pages/sales";
import pelyconLogo from "@assets/Pelycon_Logomark_RGB_Orange_1770825725925.png";

const APP_VERSION = "26.3.15";

interface UserContextType {
  user: AuthUser | null;
}

const UserContext = createContext<UserContextType>({ user: null });
export function useCurrentUser() { return useContext(UserContext); }

const NAV_GROUPS = [
  {
    label: "Sales",
    items: [
      { title: "Sales Pipeline", path: "/sales", icon: TrendingUp, accessKey: "sales" },
    ],
  },
  {
    label: "Clients",
    items: [
      { title: "Client Management", path: "/clients", icon: Building2, accessKey: "clients" },
      { title: "Receivables", path: "/receivables", icon: Receipt, accessKey: "receivables" },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "TBR Tracker", path: "/", icon: LayoutDashboard, accessKey: "dashboard" },
      { title: "TBR Reviews", path: "/reviews", icon: FilePen, accessKey: "reviews" },
      { title: "TBR Staging", path: "/staging", icon: ClipboardList, accessKey: "staging" },
    ],
  },
];

export const ALL_PAGE_KEYS = NAV_GROUPS.flatMap(g => g.items).map(i => ({ key: i.accessKey, label: i.title }));

export function hasPageAccess(user: AuthUser, accessKey: string): boolean {
  if (user.role === "admin") return true;
  if (!user.pageAccess) return true;
  if (accessKey === "accounts" && user.pageAccess["clients"] !== undefined) return user.pageAccess["clients"] !== false;
  return user.pageAccess[accessKey] !== false;
}

function AppSidebar({ onLogout, user }: { onLogout: () => void; user: AuthUser }) {
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader className="p-4 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <img src={pelyconLogo} alt="Pelycon" className="h-8 w-8 object-contain flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-sidebar-foreground truncate leading-tight">
              Pelycon Technologies
            </span>
            <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">
              Executive Platform
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(item => hasPageAccess(user, item.accessKey));
          if (visibleItems.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-4 py-1">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {user.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-4 py-1">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location === "/users"}
                    onClick={() => setLocation("/users")}
                    data-testid="nav-users"
                  >
                    <Users className="h-4 w-4" />
                    <span>User Management</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/50">
        <div className="flex flex-col gap-2">
          <div className="px-2 py-1">
            <div className="text-xs font-medium text-sidebar-foreground truncate" data-testid="text-current-user">
              {user.displayName}
            </div>
            <div className="text-[10px] text-sidebar-foreground/50 truncate">{user.email}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={toggleTheme} className="h-8 w-8" data-testid="button-theme-toggle">
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={onLogout} className="h-8 w-8" data-testid="button-logout">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
            <span className="text-[10px] font-mono text-sidebar-foreground/30 pr-1" data-testid="text-app-version">
              v{APP_VERSION}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function AuthenticatedApp({ onLogout, user }: { onLogout: () => void; user: AuthUser }) {
  const handleLogout = async () => {
    try { await apiRequest("POST", "/api/auth/logout"); } catch {}
    onLogout();
  };

  const sidebarStyle = { "--sidebar-width": "15rem", "--sidebar-width-icon": "3rem" };

  return (
    <UserContext.Provider value={{ user }}>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar onLogout={handleLogout} user={user} />
          <div className="flex flex-col flex-1 min-w-0">
            <header className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2 border-b bg-background/95 backdrop-blur-sm">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
            </header>
            <main className="flex-1 overflow-auto">
              <Switch>
                {hasPageAccess(user, "dashboard") && <Route path="/" component={Tracker} />}
                {hasPageAccess(user, "reviews") && <Route path="/reviews" component={Dashboard} />}
                {hasPageAccess(user, "staging") && <Route path="/staging" component={Staging} />}
                {hasPageAccess(user, "clients") && <Route path="/clients" component={Clients} />}
                {hasPageAccess(user, "accounts") && <Route path="/accounts" component={Clients} />}
                {hasPageAccess(user, "receivables") && <Route path="/receivables" component={Receivables} />}
                {hasPageAccess(user, "sales") && <Route path="/sales" component={Sales} />}
                {user.role === "admin" && <Route path="/users" component={UserManagement} />}
                <Route>
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">You do not have access to this page.</p>
                  </div>
                </Route>
              </Switch>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </UserContext.Provider>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setIsAuthenticated(false); return; }
    fetch("/api/auth/check", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (res.ok) return res.json(); throw new Error("Unauthorized"); })
      .then(data => { setIsAuthenticated(true); setCurrentUser(data.user); setStoredUser(data.user); })
      .catch(() => { setIsAuthenticated(false); setCurrentUser(null); clearToken(); });
  }, []);

  const handleLogin = (user: AuthUser) => { setCurrentUser(user); setIsAuthenticated(true); };
  const handleLogout = () => { clearToken(); queryClient.clear(); setCurrentUser(null); setIsAuthenticated(false); };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          {isAuthenticated && currentUser
            ? <AuthenticatedApp onLogout={handleLogout} user={currentUser} />
            : <Login onLogin={handleLogin} />}
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
