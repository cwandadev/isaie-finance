import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, ListOrdered, BarChart3, Settings, LogOut, Wallet, Calculator as CalcIcon, Moon, Sun, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import { useQueryClient } from "@tanstack/react-query";
import { Calculator } from "@/components/calculator";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ListOrdered },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggle } = useTheme();
  const [calcOpen, setCalcOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-grid">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 backdrop-blur-xl bg-background/60 border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Wallet className="size-4" />
            </div>
            <span className="font-bold tracking-tight">Isaie Finance</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
        {mobileOpen && (
          <nav className="px-4 pb-4 flex flex-col gap-1">
            {nav.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  <n.icon className="size-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <div className="flex">
        {/* Sidebar */}
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
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition group relative overflow-hidden",
                  active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-foreground/80 hover:text-foreground hover:bg-muted",
                )}
              >
                <n.icon className="size-4" /> {n.label}
              </Link>
            );
          })}

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

        <main className="flex-1 min-w-0 p-4 md:p-8 pb-24 md:pb-12">{children}</main>
      </div>

      {/* Floating calc on mobile */}
      <Button
        onClick={() => setCalcOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-30 rounded-full size-14 shadow-2xl metal-btn"
        size="icon"
      >
        <CalcIcon className="size-6" />
      </Button>

      <Calculator open={calcOpen} onOpenChange={setCalcOpen} />
    </div>
  );
}