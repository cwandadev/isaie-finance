import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isoDate, formatRwf, monthRange } from "@/lib/format";

export type TxRow = {
  id?: string;
  category_id: string | null;
  source_id: string | null;
  amount: number;
  date: string;
  note: string | null;
};

export function TransactionForm({
  open, onOpenChange, initial, viewOnly = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: TxRow | null;
  viewOnly?: boolean;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<TxRow>({
    category_id: null, source_id: null, amount: 0, date: isoDate(new Date()), note: "",
  });
  const [saving, setSaving] = useState(false);
  const [overspendOpen, setOverspendOpen] = useState(false);
  const [overspendInfo, setOverspendInfo] = useState<{ overflow: number; allowed: number } | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ?? { category_id: null, source_id: null, amount: 0, date: isoDate(new Date()), note: "" });
    }
  }, [open, initial]);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id,name,color,percentage").order("sort_order")).data ?? [],
  });
  const { data: srcs } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => (await supabase.from("sources").select("id,name").order("name")).data ?? [],
  });

  const writeTx = async (extraSavingsOverflow = 0) => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    const payload = {
      user_id: uid,
      category_id: form.category_id,
      source_id: form.source_id,
      amount: form.amount,
      date: form.date,
      note: form.note || null,
    };
    const res = initial?.id
      ? await supabase.from("transactions").update(payload).eq("id", initial.id)
      : await supabase.from("transactions").insert(payload);
    if (res.error) { setSaving(false); return toast.error(res.error.message); }

    if (extraSavingsOverflow > 0) {
      const sav = cats?.find((c) => /saving/i.test(c.name));
      if (sav) {
        await supabase.from("transactions").insert({
          user_id: uid, category_id: sav.id, source_id: form.source_id,
          amount: extraSavingsOverflow, date: form.date,
          note: `Auto: covered overspend on ${cats?.find(c=>c.id===form.category_id)?.name ?? "category"}`,
        });
      }
    }
    setSaving(false);
    toast.success(initial?.id ? "Transaction updated" : "Transaction added");
    qc.invalidateQueries();
    onOpenChange(false);
  };

  const save = async () => {
    if (!form.amount || !form.category_id) return toast.error("Amount and category are required");
    // Compute current spent for this category this month (skip for edits)
    if (!initial?.id) {
      const { start, end } = monthRange(1);
      const { data: catData } = await supabase
        .from("income_settings").select("monthly_income").maybeSingle();
      const monthlyIncome = Number(catData?.monthly_income ?? 0);
      const cat = cats?.find((c) => c.id === form.category_id);
      if (cat && monthlyIncome > 0) {
        const budget = (monthlyIncome * Number(cat.percentage ?? 0)) / 100;
        const { data: spentRows } = await supabase
          .from("transactions").select("amount")
          .eq("category_id", cat.id)
          .gte("date", isoDate(start)).lte("date", isoDate(end));
        const spent = (spentRows ?? []).reduce((a, b) => a + Number(b.amount), 0);
        const allowed = Math.max(0, budget - spent);
        if (form.amount > allowed && !/saving/i.test(cat.name)) {
          setOverspendInfo({ overflow: form.amount - allowed, allowed });
          setOverspendOpen(true);
          return;
        }
      }
    }
    await writeTx(0);
  };

  const confirmOverspend = async () => {
    setOverspendOpen(false);
    await writeTx(overspendInfo?.overflow ?? 0);
    setOverspendInfo(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gold-card gold-card-hover">
        <DialogHeader>
          <DialogTitle>{viewOnly ? "View transaction" : initial?.id ? "Edit transaction" : "New transaction"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" disabled={viewOnly} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Amount (Rwf)</Label>
              <Input type="number" min={0} placeholder="e.g. 25000" disabled={viewOnly} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select disabled={viewOnly} value={form.category_id ?? ""} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {cats?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Select disabled={viewOnly} value={form.source_id ?? ""} onValueChange={(v) => setForm({ ...form, source_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>
                {srcs?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea disabled={viewOnly} placeholder="e.g. Lunch with team, electricity bill…" value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {!viewOnly && (
            <Button onClick={save} disabled={saving} className="metal-btn">{saving ? "Saving..." : "Save"}</Button>
          )}
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={overspendOpen} onOpenChange={setOverspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use Savings to cover this?</AlertDialogTitle>
            <AlertDialogDescription>
              You have used all funds in this category. Only {formatRwf(overspendInfo?.allowed ?? 0)} is left in its budget,
              and this transaction exceeds it by {formatRwf(overspendInfo?.overflow ?? 0)}.
              Are you sure you want to use Savings to cover the overflow?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOverspend}>Use Savings</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}