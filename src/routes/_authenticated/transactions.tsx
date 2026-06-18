import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Eye, Trash2, Search } from "lucide-react";
import { formatRwf } from "@/lib/format";
import { TransactionForm, type TxRow } from "@/components/transaction-form";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Isaie Finance" }] }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<TxRow | null>(null);
  const [view, setView] = useState<TxRow | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id,name,color")).data ?? [],
  });
  const { data: srcs } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => (await supabase.from("sources").select("id,name")).data ?? [],
  });
  const { data: txs } = useQuery({
    queryKey: ["transactions", "all"],
    queryFn: async () =>
      (await supabase.from("transactions").select("*").order("date", { ascending: false })).data ?? [],
  });

  const catMap = Object.fromEntries((cats ?? []).map((c) => [c.id, c]));
  const srcMap = Object.fromEntries((srcs ?? []).map((s) => [s.id, s.name]));

  const filtered = (txs ?? []).filter((t) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (t.note ?? "").toLowerCase().includes(s) ||
      (catMap[t.category_id ?? ""]?.name ?? "").toLowerCase().includes(s) ||
      (srcMap[t.source_id ?? ""] ?? "").toLowerCase().includes(s) ||
      String(t.amount).includes(s)
    );
  });

  const handleDelete = async () => {
    if (!del) return;
    const { error } = await supabase.from("transactions").delete().eq("id", del);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setDel(null);
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} entries</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="metal-btn">
          <Plus className="size-4" /> New transaction
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="Search note, category, source..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <div className="gold-card gold-card-hover overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Note</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const c = catMap[t.category_id ?? ""];
                return (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/40 transition">
                    <td className="p-3 font-mono text-xs">{t.date}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: c?.color }} />
                        {c?.name ?? "—"}
                      </span>
                    </td>
                    <td className="p-3">{srcMap[t.source_id ?? ""] ?? "—"}</td>
                    <td className="p-3 max-w-xs truncate text-muted-foreground">{t.note ?? "—"}</td>
                    <td className="p-3 text-right font-mono font-semibold">{formatRwf(Number(t.amount))}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setView(t as TxRow)}><Eye className="size-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setEdit(t as TxRow)}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDel(t.id)}><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No transactions yet — add your first one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TransactionForm open={addOpen} onOpenChange={setAddOpen} />
      <TransactionForm open={!!edit} onOpenChange={(v) => !v && setEdit(null)} initial={edit} />
      <TransactionForm open={!!view} onOpenChange={(v) => !v && setView(null)} initial={view} viewOnly />

      <AlertDialog open={!!del} onOpenChange={(v) => !v && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}