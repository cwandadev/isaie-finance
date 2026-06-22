import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X, ShieldAlert, KeyRound } from "lucide-react";

const SUPER_ADMINS = ["turikumanaisaie@gmail.com", "tieflab@gmail.com"];

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "User management — Isaie Finance" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user?.email || !SUPER_ADMINS.includes(data.user.email)) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const setStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`User ${status}`);
    qc.invalidateQueries({ queryKey: ["profiles-all"] });
    qc.invalidateQueries({ queryKey: ["pending-count"] });
  };

  const resetPassword = async (email: string | null) => {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) return toast.error(error.message);
    toast.success(`Password reset email sent to ${email}`);
  };

  const pending = (users ?? []).filter((u) => u.status === "pending");
  const others = (users ?? []).filter((u) => u.status !== "pending");

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-lg">
          <ShieldAlert className="size-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User management</h1>
          <p className="text-sm text-muted-foreground">Approve or reject signups</p>
        </div>
      </div>

      <section className="gold-card gold-card-hover p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Pending approvals</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-mono">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {pending.map((u) => (
              <li key={u.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.display_name ?? u.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setStatus(u.id, "approved")} className="metal-btn">
                    <Check className="size-4" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(u.id, "rejected")}>
                    <X className="size-4" /> Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="gold-card gold-card-hover p-6 space-y-4">
        <h2 className="font-semibold">All users</h2>
        <ul className="divide-y divide-border/60">
          {others.map((u) => (
            <li key={u.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{u.display_name ?? u.email}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] px-2 py-1 rounded-full font-mono ${
                    u.status === "approved"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {u.status}
                </span>
                {u.status === "rejected" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(u.id, "approved")}>
                    <Check className="size-4" /> Re-approve
                  </Button>
                )}
                {u.status === "approved" && u.email !== "turikumanaisaie@gmail.com" && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(u.id, "rejected")}>
                    <X className="size-4" /> Block
                  </Button>
                )}
                {!SUPER_ADMINS.includes(u.email ?? "") && (
                  <Button size="sm" variant="outline" onClick={() => resetPassword(u.email)}>
                    <KeyRound className="size-4" /> Reset password
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}