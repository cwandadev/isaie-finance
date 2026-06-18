import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRwf, monthRange, isoDate } from "@/lib/format";
import { Plus, TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { TransactionForm } from "@/components/transaction-form";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Isaie Finance" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [addOpen, setAddOpen] = useState(false);
  const { start, end } = monthRange(1);

  const { data: income } = useQuery({
    queryKey: ["income"],
    queryFn: async () => (await supabase.from("income_settings").select("*").maybeSingle()).data,
  });
  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });
  const { data: txs } = useQuery({
    queryKey: ["transactions", "thisMonth"],
    queryFn: async () =>
      (await supabase
        .from("transactions")
        .select("*")
        .gte("date", isoDate(start))
        .lte("date", isoDate(end))
        .order("date", { ascending: false })).data ?? [],
  });
  const { data: allSavingsTx } = useQuery({
    queryKey: ["savings-balance"],
    queryFn: async () => {
      const sav = cats?.find((c) => /saving/i.test(c.name));
      if (!sav) return { spent: 0 };
      const { data } = await supabase.from("transactions").select("amount").eq("category_id", sav.id);
      return { spent: (data ?? []).reduce((a, b) => a + Number(b.amount), 0) };
    },
    enabled: !!cats,
  });

  const monthlyIncome = Number(income?.monthly_income ?? 200000);
  const totalSpent = (txs ?? []).reduce((a, b) => a + Number(b.amount), 0);
  const remaining = monthlyIncome - totalSpent;

  const byCat = (cats ?? []).map((c) => {
    const spent = (txs ?? []).filter((t) => t.category_id === c.id).reduce((a, b) => a + Number(b.amount), 0);
    const budget = (monthlyIncome * Number(c.percentage)) / 100;
    return { ...c, spent, budget, remaining: budget - spent };
  });

  // Savings accumulated: total budget allocated to savings since signup minus total savings withdrawals (we treat savings tx as withdrawal). Simpler model: cumulative budget - cumulative tx.
  const savingsCat = byCat.find((c) => /saving/i.test(c.name));
  const savingsBalance = savingsCat
    ? Math.max(0, (savingsCat.budget) - (allSavingsTx?.spent ?? 0))
    : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="metal-btn">
          <Plus className="size-4" /> New transaction
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Salary" value={formatRwf(monthlyIncome)} icon={<Wallet className="size-5" />} accent="from-primary/30 to-primary/5" />
        <StatCard label="Total Spent" value={formatRwf(totalSpent)} icon={<TrendingDown className="size-5" />} accent="from-red-500/30 to-red-500/5" />
        <StatCard label="Remaining" value={formatRwf(remaining)} icon={<TrendingUp className="size-5" />} accent="from-emerald-500/30 to-emerald-500/5" />
        <StatCard label="Savings Balance" value={formatRwf(savingsBalance)} icon={<PiggyBank className="size-5" />} accent="from-amber-500/30 to-amber-500/5" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="gold-card gold-card-hover p-6">
          <h2 className="font-semibold mb-1">Spending distribution</h2>
          <p className="text-xs text-muted-foreground mb-4">This month, by category</p>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCat.filter(c=>c.spent>0)} dataKey="spent" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {byCat.map((c) => <Cell key={c.id} fill={c.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatRwf(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="gold-card gold-card-hover p-6">
          <h2 className="font-semibold mb-1">Budget vs Spent</h2>
          <p className="text-xs text-muted-foreground mb-4">Each category's allocation</p>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={byCat} margin={{ left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatRwf(v)} />
                <Bar dataKey="budget" fill="oklch(0.85 0.12 85)" radius={[4,4,0,0]} />
                <Bar dataKey="spent" radius={[4,4,0,0]}>
                  {byCat.map((c) => <Cell key={c.id} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Categories</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {byCat.map((c) => {
            const pct = c.budget > 0 ? Math.min(100, (c.spent / c.budget) * 100) : 0;
            return (
              <Link
                key={c.id}
                to="/category/$id"
                params={{ id: c.id }}
                className="gold-card gold-card-hover p-5 block"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="size-10 rounded-xl flex items-center justify-center text-white shadow-md" style={{ background: c.color }}>
                      <Wallet className="size-5" />
                    </span>
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.percentage}% of income</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Spent</span>
                  <span className="font-mono font-semibold">{formatRwf(c.spent)}</span>
                </div>
                <div className="flex items-baseline justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="font-mono">{formatRwf(c.budget)}</span>
                </div>
                <div className="flex items-baseline justify-between text-xs mt-1">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className={`font-mono ${c.remaining < 0 ? "text-destructive" : "text-emerald-500"}`}>{formatRwf(c.remaining)}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c.color }} />
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground text-right">{pct.toFixed(0)}% of budget used</div>
              </Link>
            );
          })}
        </div>
      </div>

      <TransactionForm open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="gold-card gold-card-hover p-5 relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
          <span className="text-foreground/70">{icon}</span>
        </div>
        <div className="text-2xl font-bold tracking-tight font-mono">{value}</div>
      </div>
    </div>
  );
}