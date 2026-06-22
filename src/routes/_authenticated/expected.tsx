import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Check, Trash2, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { formatRwf } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/expected")({
  head: () => ({ meta: [{ title: "Expected income — Isaie Finance" }] }),
  component: ExpectedPage,
});

function ExpectedPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["expected"],
    queryFn: async () =>
      (await supabase.from("expected_income").select("*").order("expected_date", { ascending: true })).data ?? [],
  });
  const { data: srcs } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => (await supabase.from("sources").select("*").order("name")).data ?? [],
  });

  const sourceName = (id: string | null) => srcs?.find((s) => s.id === id)?.name ?? "—";

  const markReceived = async (id: string, received: boolean) => {
    const { error } = await supabase
      .from("expected_income")
      .update({ received, received_at: received ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(received ? "Marked received" : "Reverted");
    qc.invalidateQueries();
  };

  const remove = async (id: string) => {
    await supabase.from("expected_income").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["expected"] });
    qc.invalidateQueries({ queryKey: ["expected-pending"] });
  };

  const pending = (items ?? []).filter((i) => !i.received);
  const received = (items ?? []).filter((i) => i.received);
  const pendingTotal = pending.reduce((a, b) => a + Number(b.amount), 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expected income</h1>
          <p className="text-sm text-muted-foreground">Track upcoming or unexpected money</p>
        </div>
        <Button onClick={() => setOpen(true)} className="metal-btn">
          <Plus className="size-4" /> Log expected
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="gold-card gold-card-hover p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Pending total</div>
          <div className="text-2xl font-bold font-mono mt-1">{formatRwf(pendingTotal)}</div>
          <div className="text-xs text-muted-foreground mt-1">{pending.length} item(s)</div>
        </div>
        <div className="gold-card gold-card-hover p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Received</div>
          <div className="text-2xl font-bold font-mono mt-1">{formatRwf(received.reduce((a, b) => a + Number(b.amount), 0))}</div>
          <div className="text-xs text-muted-foreground mt-1">{received.length} item(s)</div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Clock className="size-4" /> Pending</h2>
        {pending.length === 0 ? (
          <div className="gold-card p-6 text-sm text-muted-foreground text-center">Nothing pending.</div>
        ) : (
          pending.map((i) => (
            <div key={i.id} className="gold-card gold-card-hover p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{formatRwf(Number(i.amount))}</span>
                  {i.is_recurring && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase font-semibold">
                      {i.frequency ?? "recurring"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {sourceName(i.source_id)} • {new Date(i.expected_date).toLocaleDateString()}
                  {i.note && ` • ${i.note}`}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" onClick={() => markReceived(i.id, true)} className="metal-btn">
                  <Check className="size-4" /> Received
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(i.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </section>

      {received.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Sparkles className="size-4" /> Received</h2>
          {received.map((i) => (
            <div key={i.id} className="gold-card p-4 flex flex-wrap items-center justify-between gap-3 opacity-80">
              <div>
                <div className="font-mono font-semibold">{formatRwf(Number(i.amount))}</div>
                <div className="text-xs text-muted-foreground">
                  {sourceName(i.source_id)} • received {i.received_at ? new Date(i.received_at).toLocaleDateString() : ""}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => markReceived(i.id, false)}>Undo</Button>
                <Button size="icon" variant="ghost" onClick={() => remove(i.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <ExpectedForm open={open} onOpenChange={setOpen} sources={srcs ?? []} />
    </div>
  );
}

function ExpectedForm({
  open, onOpenChange, sources,
}: { open: boolean; onOpenChange: (v: boolean) => void; sources: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [sourceId, setSourceId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [note, setNote] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState("monthly");
  const [expectedDate, setExpectedDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id,name,color").order("sort_order")).data ?? [],
  });

  // Default destination = Savings
  useEffect(() => {
    if (!categoryId && cats && cats.length) {
      const sav = cats.find((c) => /saving/i.test(c.name));
      setCategoryId(sav?.id ?? cats[0].id);
    }
  }, [cats, categoryId]);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return toast.error("Enter an amount");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("expected_income").insert({
      user_id: u.user!.id,
      amount: Number(amount),
      source_id: sourceId || null,
      category_id: categoryId || null,
      note: note || null,
      is_recurring: isRecurring,
      frequency: isRecurring ? frequency : null,
      expected_date: expectedDate,
    });
    if (error) return toast.error(error.message);
    toast.success("Logged");
    setAmount(""); setNote(""); setIsRecurring(false);
    onOpenChange(false);
    qc.invalidateQueries();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log expected income</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Amount (Rwf)</Label>
            <Input type="number" placeholder="e.g. 50000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Destination (where will it land)</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger><SelectValue placeholder="Select account / wallet" /></SelectTrigger>
              <SelectContent>
                {sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Destination category (defaults to Savings)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {(cats ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">When marked received, this category's budget increases by this amount.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Expected date</Label>
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <Label className="text-sm">Recurring?</Label>
              <p className="text-xs text-muted-foreground">One-time or repeating</p>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>
          {isRecurring && (
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea placeholder="e.g. Freelance payment from client X" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button onClick={submit} className="w-full metal-btn">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}