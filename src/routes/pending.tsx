import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, LogOut, Wallet } from "lucide-react";

export const Route = createFileRoute("/pending")({
  ssr: false,
  head: () => ({ meta: [{ title: "Pending approval — Isaie Finance" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.status === "approved") throw redirect({ to: "/dashboard" });
    return { profile, email: data.user.email };
  },
  component: Pending,
});

function Pending() {
  const { profile, email } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const rejected = profile?.status === "rejected";

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-grid">
      <div className="gold-card gold-card-hover p-8 max-w-md w-full text-center space-y-5">
        <div className="mx-auto size-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
          {rejected ? <Wallet className="size-8" /> : <Clock className="size-8" />}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {rejected ? "Access denied" : "Awaiting approval"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {rejected
              ? "Your account was not approved. You can wait for the admin to re-review, or contact them directly."
              : "Your account is pending review. The admin will approve you shortly."}
          </p>
        </div>
        <div className="text-xs text-muted-foreground break-all">Signed in as: {email}</div>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => window.location.reload()} className="metal-btn">
            Refresh status
          </Button>
          <Button variant="ghost" onClick={signOut} className="text-destructive">
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}