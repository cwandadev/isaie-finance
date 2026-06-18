import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRwf } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/category/$id")({
  head: () => ({ meta: [{ title: "Category — Isaie Finance" }] }),
  component: CategoryDetail,
});

function CategoryDetail() {
  const { id } = Route.useParams();

  const { data: cat } = useQuery({
    queryKey: ["category", id],
    queryFn: async () => (await supabase.from("categories").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: txs } = useQuery({
    queryKey: ["category-tx", id],
    queryFn: async () =>
      (await supabase.from("transactions").select("*").eq("category_id", id).order("date", { ascending: false })).data ?? [],
  });
  const { data: srcs } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => (await supabase.from("sources").select("id,name")).data ?? [],
  });
  const srcMap = Object.fromEntries((srcs ?? []).map((s) => [s.id, s.name]));

  const total = (txs ?? []).reduce((a, b) => a + Number(b.amount), 0);

  // Monthly trend
  const byMonth = new Map<string, number>();
  (txs ?? []).forEach((t) => byMonth.set(t.date.slice(0,7), (byMonth.get(t.date.slice(0,7)) ?? 0) + Number(t.amount)));
  const trend = Array.from(byMonth.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([month,total])=>({month,total}));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>

      <div className="flex items-center gap-4">
        <span className="size-14 rounded-2xl shadow-lg" style={{ background: cat?.color ?? "#888" }} />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{cat?.name ?? "Category"}</h1>
          <p className="text-sm text-muted-foreground">{cat?.percentage}% of income · {(txs ?? []).length} transactions</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Lifetime total</div>
          <div className="text-3xl font-bold font-mono text-gold">{formatRwf(total)}</div>
        </div>
      </div>

      <div className="gold-card gold-card-hover p-6">
        <h2 className="font-semibold mb-4">Spending over time</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.05 250 / 0.2)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatRwf(v)} />
              <Line type="monotone" dataKey="total" stroke={cat?.color ?? "var(--color-primary)"} strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="gold-card gold-card-hover overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Note</th>
                <th className="text-right p-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(txs ?? []).map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-muted/40 transition">
                  <td className="p-3 font-mono text-xs">{t.date}</td>
                  <td className="p-3">{srcMap[t.source_id ?? ""] ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{t.note ?? "—"}</td>
                  <td className="p-3 text-right font-mono font-semibold">{formatRwf(Number(t.amount))}</td>
                </tr>
              ))}
              {(txs ?? []).length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No transactions in this category yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}