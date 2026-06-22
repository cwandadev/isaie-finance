import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, LogOut, ShieldAlert, Moon, Sun, Lock, User as UserIcon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Isaie Finance" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [email, setEmail] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setUid(data.user?.id ?? null);
    });
  }, []);
  const isSuperAdmin = email === "turikumanaisaie@gmail.com" || email === "tieflab@gmail.com";

  const { data: profile } = useQuery({
    queryKey: ["my-profile", uid],
    enabled: !!uid,
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", uid!).maybeSingle()).data,
  });

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setUsername(profile.username ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  const saveProfile = async () => {
    if (!uid) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName || null, username: username || null, avatar_url: avatarUrl || null })
      .eq("id", uid);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["my-profile"] });
  };

  const initials = (displayName || email || "?")
    .split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-count"],
    queryFn: async () => {
      if (!isSuperAdmin) return 0;
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
    enabled: isSuperAdmin,
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const { data: income } = useQuery({
    queryKey: ["income"],
    queryFn: async () => (await supabase.from("income_settings").select("*").maybeSingle()).data,
  });
  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });
  const { data: srcs } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => (await supabase.from("sources").select("*").order("name")).data ?? [],
  });

  const [monthly, setMonthly] = useState<string>("");
  const [salaryDay, setSalaryDay] = useState<string>("29");
  useEffect(() => {
    if (income) {
      setMonthly(income.monthly_income != null ? String(income.monthly_income) : "");
      setSalaryDay(income.salary_day != null ? String(income.salary_day) : "29");
    }
  }, [income]);

  const saveIncome = async () => {
    if (!income) return;
    const m = Number(monthly);
    const d = Number(salaryDay);
    if (!m || m <= 0) return toast.error("Enter your monthly income");
    if (!d || d < 1 || d > 31) return toast.error("Salary day must be 1–31");
    const { error } = await supabase.from("income_settings").update({
      monthly_income: m, salary_day: d,
    }).eq("id", income.id);
    if (error) return toast.error(error.message);
    toast.success("Income updated");
    qc.invalidateQueries();
  };

  const updateCat = async (id: string, patch: { name?: string; percentage?: number; color?: string }) => {
    const { error } = await supabase.from("categories").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["categories"] });
  };
  const addCat = async () => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("categories").insert({
      user_id: u.user!.id, name: "New Category", percentage: 0, color: "#6366f1",
      sort_order: (cats?.length ?? 0) + 1,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["categories"] });
  };
  const delCat = async (id: string, isProtected: boolean) => {
    if (isProtected) return toast.error("This category is protected and cannot be deleted");
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const addSrc = async () => {
    const name = prompt("Source name?")?.trim();
    if (!name) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("sources").insert({ user_id: u.user!.id, name });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["sources"] });
  };
  const delSrc = async (id: string) => {
    await supabase.from("sources").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["sources"] });
  };

  const totalPct = (cats ?? []).reduce((a, b) => a + Number(b.percentage), 0);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Adjust income, categories and sources</p>
      </div>

      {/* Profile */}
      <section className="gold-card gold-card-hover p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><UserIcon className="size-4" /> Profile</h2>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="size-16 rounded-full object-cover border border-border" />
          ) : (
            <div className="size-16 rounded-full grid place-items-center bg-primary text-primary-foreground text-xl font-bold shadow-md">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold truncate">{displayName || "—"}</div>
            <div className="text-xs text-muted-foreground truncate">{email}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input placeholder="e.g. Isaie Turikumana" value={displayName} onChange={(e)=>setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input placeholder="e.g. isaie" value={username} onChange={(e)=>setUsername(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Avatar URL (optional)</Label>
            <Input placeholder="https://…" value={avatarUrl} onChange={(e)=>setAvatarUrl(e.target.value)} />
          </div>
        </div>
        <Button onClick={saveProfile} className="metal-btn">Save profile</Button>
      </section>

      {isSuperAdmin && (
        <Link to="/users" className="gold-card gold-card-hover p-5 flex items-center justify-between group">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-md">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <div className="font-semibold">User management</div>
              <div className="text-xs text-muted-foreground">Approve or reject signups</div>
            </div>
          </div>
          {pendingCount > 0 && (
            <span className="min-w-7 h-7 px-2 rounded-full bg-destructive text-destructive-foreground text-xs font-bold grid place-items-center">
              {pendingCount}
            </span>
          )}
        </Link>
      )}

      <section className="gold-card gold-card-hover p-6 space-y-4">
        <h2 className="font-semibold">Monthly income</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label>Fixed recurring monthly income (Rwf)</Label>
            <Input type="number" inputMode="numeric" placeholder="e.g. 200000" value={monthly}
              onChange={(e)=>setMonthly(e.target.value)} />
          </div>
          <div className="space-y-2 w-24">
            <Label>Salary day</Label>
            <Input type="number" min={1} max={31} placeholder="29" className="text-center" value={salaryDay}
              onChange={(e)=>setSalaryDay(e.target.value)} />
          </div>
        </div>
        <Button onClick={saveIncome} className="metal-btn">Save income</Button>
      </section>

      <section className="gold-card gold-card-hover p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Categories</h2>
            <p className="text-xs text-muted-foreground">Total allocation: <span className={totalPct === 100 ? "text-emerald-500" : "text-amber-500"}>{totalPct}%</span></p>
          </div>
          <Button variant="outline" size="sm" onClick={addCat} className="metal-btn"><Plus className="size-4" /> Add</Button>
        </div>
        <div className="space-y-2">
          {cats?.map((c) => (
            <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5 flex items-center gap-1">
                {c.is_protected && <Lock className="size-3.5 text-muted-foreground shrink-0" />}
                <Input placeholder="Category name" defaultValue={c.name} onBlur={(e)=>e.target.value !== c.name && updateCat(c.id,{ name: e.target.value })} />
              </div>
              <Input className="col-span-3" type="number" step="0.01" placeholder="% e.g. 25" defaultValue={c.percentage}
                onBlur={(e)=>Number(e.target.value) !== Number(c.percentage) && updateCat(c.id,{ percentage: Number(e.target.value) })} />
              <Input className="col-span-3" type="color" defaultValue={c.color}
                onBlur={(e)=>e.target.value !== c.color && updateCat(c.id,{ color: e.target.value })} />
              <Button variant="ghost" size="icon" disabled={c.is_protected} onClick={()=>delCat(c.id, c.is_protected)}>
                <Trash2 className={`size-4 ${c.is_protected ? "text-muted-foreground/40" : "text-destructive"}`} />
              </Button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Protected categories (e.g. Savings) cannot be deleted but their percentage is still editable.</p>
      </section>

      <section className="gold-card gold-card-hover p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Sources</h2>
          <Button variant="outline" size="sm" onClick={addSrc} className="metal-btn"><Plus className="size-4" /> Add source</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {srcs?.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm border border-border">
              {s.name}
              <button onClick={()=>delSrc(s.id)} className="text-destructive hover:opacity-70"><Trash2 className="size-3" /></button>
            </span>
          ))}
        </div>
      </section>

      {/* Mobile-only quick actions */}
      <section className="gold-card p-4 space-y-2 md:hidden">
        <Button variant="outline" onClick={toggle} className="w-full justify-start metal-btn">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </Button>
        <Button variant="ghost" onClick={signOut} className="w-full justify-start text-destructive">
          <LogOut className="size-4" /> Sign out
        </Button>
      </section>
    </div>
  );
}