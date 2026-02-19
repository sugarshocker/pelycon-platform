import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, getToken, clearToken, apiRequest } from "./lib/queryClient";
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
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Tracker from "@/pages/tracker";
import Staging from "@/pages/staging";
import pelyconLogo from "@assets/Pelycon_Logomark_RGB_Orange_1770825725925.png";

const NAV_ITEMS = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "TBR Reviews", path: "/reviews", icon: FilePen },
  { title: "Staging", path: "/staging", icon: ClipboardList },
];

function AppSidebar({ onLogout }: { onLogout: () => void }) {
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img
            src={pelyconLogo}
            alt="Pelycon"
            className="h-8 w-8 object-contain flex-shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-sidebar-foreground truncate">
              Pelycon Technologies
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              TBR Platform
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
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
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      onLogout();
    } catch {
      onLogout();
    }
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar onLogout={handleLogout} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-50 flex items-center gap-2 p-2 border-b bg-background/95 backdrop-blur-sm">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={Tracker} />
              <Route path="/reviews" component={Dashboard} />
              <Route path="/staging" component={Staging} />
              <Route>
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Page not found</p>
                </div>
              </Route>
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsAuthenticated(false);
      return;
    }
    fetch("/api/auth/check", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        setIsAuthenticated(res.ok);
        if (!res.ok) clearToken();
      })
      .catch(() => {
        setIsAuthenticated(false);
        clearToken();
      });
  }, []);

  const handleLogout = () => {
    clearToken();
    queryClient.clear();
    setIsAuthenticated(false);
  };

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
          {isAuthenticated ? (
            <AuthenticatedApp onLogout={handleLogout} />
          ) : (
            <Login onLogin={() => setIsAuthenticated(true)} />
          )}
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
