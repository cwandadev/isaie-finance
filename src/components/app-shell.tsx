import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, ListOrdered, BarChart3, Settings, LogOut, Wallet,
  Calculator as CalcIcon, Moon, Sun, Sparkles, ShieldAlert,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator } from "@/components/calculator";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; badge?: number };

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggle } = useTheme();
  const [calcOpen, setCalcOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const isSuperAdmin = email === "turikumanaisaie@gmail.com";

  // Badges
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-count"],
    queryFn: async () => {
      if (!isSuperAdmin) return 0;
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
    enabled: isSuperAdmin,
  });
  const { data: expectedPending = 0 } = useQuery({
    queryKey: ["expected-pending"],
    queryFn: async () => {
      const { count } = await supabase.from("expected_income").select("*", { count: "exact", head: true }).eq("received", false);
      return count ?? 0;
    },
  });

  const nav: NavItem[] = [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard },
    { to: "/transactions", label: "History", icon: ListOrdered },
    { to: "/expected", label: "Expected", icon: Sparkles, badge: expectedPending },
    { to: "/analytics", label: "Stats", icon: BarChart3 },
    { to: "/settings", label: "Settings", icon: Settings, badge: pendingCount },
  ];

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-grid">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
              <Wallet className="size-4" />
            </div>
            <div>
              <div className="font-bold tracking-tight text-sm leading-none">Isaie Finance</div>
              <div className="text-[10px] text-muted-foreground">Budget command center</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} className="size-9">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCalcOpen(true)} className="size-9">
              <CalcIcon className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar (desktop unchanged) */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col gap-2 p-4 sticky top-0 h-screen border-r border-border bg-sidebar/60 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-2 pt-2 pb-4">
            <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
              <Wallet className="size-5" />
            </div>
            <div>
              <div className="font-bold tracking-tight">Isaie Finance</div>
              <div className="text-[11px] text-muted-foreground">Budget command center</div>
            </div>
          </div>
          <div className="gold-line my-2" />
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition relative",
                  active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-foreground/80 hover:text-foreground hover:bg-muted",
                )}
              >
                <n.icon className="size-4" /> {n.label}
                {!!n.badge && n.badge > 0 && (
                  <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
                    {n.badge}
                  </span>
                )}
              </Link>
            );
          })}
          {isSuperAdmin && (
            <Link
              to="/users"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition relative",
                pathname.startsWith("/users")
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-foreground/80 hover:text-foreground hover:bg-muted",
              )}
            >
              <ShieldAlert className="size-4" /> Users
              {pendingCount > 0 && (
                <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
                  {pendingCount}
                </span>
              )}
            </Link>
          )}

          <div className="mt-auto flex flex-col gap-2">
            <div className="gold-line my-2" />
            <Button variant="outline" size="sm" onClick={() => setCalcOpen(true)} className="justify-start metal-btn">
              <CalcIcon className="size-4" /> Calculator
            </Button>
            <Button variant="outline" size="sm" onClick={toggle} className="justify-start metal-btn">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="justify-start text-destructive hover:text-destructive">
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-4 md:p-8 pb-28 md:pb-12">{children}</main>
      </div>

      {/* Mobile bottom nav (native-app feel) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pt-2 pointer-events-none">
        <div className="pointer-events-auto mx-auto max-w-md rounded-3xl bg-background/85 backdrop-blur-2xl border border-border shadow-2xl">
          <div className="grid grid-cols-5 items-end h-16 px-2 relative">
            {nav.map((n, idx) => {
              const active = pathname.startsWith(n.to);
              const isCenter = idx === 2; // Expected = elevated center
              if (isCenter) {
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className="relative -mt-8 mx-auto"
                    aria-label={n.label}
                  >
                    <div className={cn(
                      "size-14 rounded-full grid place-items-center shadow-xl transition-transform",
                      "bg-primary text-primary-foreground ring-4 ring-background",
                      active ? "scale-105" : "hover:scale-105",
                    )}>
                      <n.icon className="size-6" />
                    </div>
                    {!!n.badge && n.badge > 0 && (
                      <span className="absolute -top-1 -right-1 size-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold grid place-items-center ring-2 ring-background">
                        {n.badge}
                      </span>
                    )}
                  </Link>
                );
              }
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-medium transition",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <n.icon className={cn("size-5", active && "drop-shadow-[0_0_8px_currentColor]")} />
                  <span>{n.label}</span>
                  {active && <span className="absolute bottom-1 size-1 rounded-full bg-primary" />}
                  {!!n.badge && n.badge > 0 && (
                    <span className="absolute top-1 right-3 size-2 rounded-full bg-destructive ring-2 ring-background" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <Calculator open={calcOpen} onOpenChange={setCalcOpen} />
    </div>
  );
}