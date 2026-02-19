import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { setToken, setStoredUser, queryClient } from "@/lib/queryClient";
import type { AuthUser } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import pelyconLogo from "@assets/Pelycon_Logomark_RGB_Orange_1770825725925.png";

interface LoginProps {
  onLogin: (user: AuthUser) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [setupName, setSetupName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/auth/needs-setup")
      .then((r) => r.json())
      .then((d) => setNeedsSetup(d.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      setToken(data.token);
      setStoredUser(data.user);
      queryClient.clear();
      onLogin(data.user);
    } catch (err: any) {
      toast({
        title: "Login Failed",
        description: err.message || "Invalid email or password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName: setupName, role: "admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Setup failed");
      setToken(data.token);
      setStoredUser(data.user);
      queryClient.clear();
      onLogin(data.user);
    } catch (err: any) {
      toast({
        title: "Setup Failed",
        description: err.message || "Could not create admin account.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (needsSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <img src={pelyconLogo} alt="Pelycon Technologies" className="h-10 w-10 object-contain" />
            <span className="text-xl font-semibold tracking-tight">
              Pelycon Technologies
            </span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-login-title">
              Technology Business Review
            </h1>
            <p className="text-muted-foreground mt-1">
              {needsSetup
                ? "Create your admin account to get started"
                : "Sign in to access the dashboard"}
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={needsSetup ? handleSetup : handleLogin} className="space-y-4">
              {needsSetup && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Your Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="displayName"
                      type="text"
                      value={setupName}
                      onChange={(e) => setSetupName(e.target.value)}
                      placeholder="Full name"
                      className="pl-10"
                      autoFocus
                      data-testid="input-display-name"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10"
                    autoFocus={!needsSetup}
                    data-testid="input-email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={needsSetup ? "Create a password (min 6 chars)" : "Enter your password"}
                    className="pl-10 pr-10"
                    data-testid="input-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !email || !password || (needsSetup && !setupName)}
                data-testid="button-login"
              >
                {isLoading
                  ? (needsSetup ? "Creating Account..." : "Signing in...")
                  : (needsSetup ? "Create Admin Account" : "Sign In")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
