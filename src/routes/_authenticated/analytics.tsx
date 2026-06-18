import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { formatRwf, isoDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Isaie Finance" }] }),
  component: AnalyticsPage,
});

type Preset = "1m" | "3m" | "6m" | "1y" | "custom";

function rangeFor(p: Preset, from?: string, to?: string) {
  const end = p === "custom" && to ? new Date(to) : new Date();
  const start = new Date(end);
  if (p === "custom" && from) {
    return { start: new Date(from), end };
  }
  const months = p === "1m" ? 1 : p === "3m" ? 3 : p === "6m" ? 6 : 12;
  start.setMonth(start.getMonth() - months + 1);
  start.setDate(1);
  return { start, end };
}

function AnalyticsPage() {
  const [preset, setPreset] = useState<Preset>("3m");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { start, end } = rangeFor(preset, from, to);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });
  const { data: txs } = useQuery({
    queryKey: ["tx-range", isoDate(start), isoDate(end)],
    queryFn: async () =>
      (await supabase.from("transactions").select("*").gte("date", isoDate(start)).lte("date", isoDate(end))).data ?? [],
  });

  const byCat = useMemo(() => {
    return (cats ?? []).map((c) => {
      const spent = (txs ?? []).filter((t) => t.category_id === c.id).reduce((a, b) => a + Number(b.amount), 0);
      return { name: c.name, color: c.color, spent };
    });
  }, [cats, txs]);

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    (txs ?? []).forEach((t) => {
      const k = t.date.slice(0, 7);
      map.set(k, (map.get(k) ?? 0) + Number(t.amount));
    });
    return Array.from(map.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([month, total]) => ({ month, total }));
  }, [txs]);

  const total = (txs ?? []).reduce((a, b) => a + Number(b.amount), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Filter your spending by time range</p>
      </div>

      <div className="gold-card gold-card-hover p-4 flex flex-wrap items-end gap-3">
        {(["1m","3m","6m","1y","custom"] as Preset[]).map((p) => (
          <Button key={p} variant={preset === p ? "default" : "outline"} size="sm" onClick={() => setPreset(p)} className="metal-btn">
            {p === "1m" ? "1 month" : p === "3m" ? "3 months" : p === "6m" ? "6 months" : p === "1y" ? "1 year" : "Custom"}
          </Button>
        ))}
        {preset === "custom" && (
          <>
            <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} /></div>
          </>
        )}
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground">Total spent in range</div>
          <div className="text-2xl font-bold font-mono text-gold">{formatRwf(total)}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="gold-card gold-card-hover p-6">
          <h2 className="font-semibold mb-4">By category</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCat.filter(c=>c.spent>0)} dataKey="spent" nameKey="name" outerRadius={100} label={(d)=>d.name}>
                  {byCat.map((c) => <Cell key={c.name} fill={c.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatRwf(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="gold-card gold-card-hover p-6">
          <h2 className="font-semibold mb-4">Trend over time</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.05 250 / 0.2)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatRwf(v)} />
                <Line type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="gold-card gold-card-hover p-6 lg:col-span-2">
          <h2 className="font-semibold mb-4">Category totals</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={byCat}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatRwf(v)} />
                <Bar dataKey="spent" radius={[6,6,0,0]}>
                  {byCat.map((c) => <Cell key={c.name} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}