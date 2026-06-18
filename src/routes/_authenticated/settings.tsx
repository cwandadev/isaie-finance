import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Isaie Finance" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();

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

  const [monthly, setMonthly] = useState(0);
  const [salaryDay, setSalaryDay] = useState(1);
  useEffect(() => {
    if (income) { setMonthly(Number(income.monthly_income)); setSalaryDay(income.salary_day ?? 1); }
  }, [income]);

  const saveIncome = async () => {
    if (!income) return;
    const { error } = await supabase.from("income_settings").update({
      monthly_income: monthly, salary_day: salaryDay,
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
  const delCat = async (id: string) => {
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

      <section className="gold-card gold-card-hover p-6 space-y-4">
        <h2 className="font-semibold">Monthly income</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-2 sm:col-span-2">
            <Label>Fixed recurring monthly income (Rwf)</Label>
            <Input type="number" placeholder="e.g. 200000" value={monthly} onChange={(e)=>setMonthly(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Salary day (1–31)</Label>
            <Input type="number" min={1} max={31} placeholder="e.g. 1" value={salaryDay} onChange={(e)=>setSalaryDay(Number(e.target.value))} />
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
              <Input className="col-span-5" placeholder="Category name" defaultValue={c.name} onBlur={(e)=>e.target.value !== c.name && updateCat(c.id,{ name: e.target.value })} />
              <Input className="col-span-3" type="number" step="0.01" placeholder="% e.g. 25" defaultValue={c.percentage}
                onBlur={(e)=>Number(e.target.value) !== Number(c.percentage) && updateCat(c.id,{ percentage: Number(e.target.value) })} />
              <Input className="col-span-3" type="color" defaultValue={c.color}
                onBlur={(e)=>e.target.value !== c.color && updateCat(c.id,{ color: e.target.value })} />
              <Button variant="ghost" size="icon" onClick={()=>delCat(c.id)}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
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
    </div>
  );
}