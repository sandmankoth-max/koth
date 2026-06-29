import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/koth/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Flag } from "lucide-react";

type Report = {
  id: string;
  reporter_id: string;
  reporter_username: string | null;
  reported_user_id: string;
  reported_username: string | null;
  reported_avatar_url: string | null;
  reason: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

export function ReportsPanel() {
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [items, setItems] = useState<Report[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase.rpc("admin_list_reports" as any, { p_status: tab });
    if (error) { toast.error(error.message); return; }
    setItems((data ?? []) as Report[]);
  }

  useEffect(() => { load(); }, [tab]);

  async function resolve(id: string) {
    setBusy(id);
    const { error } = await supabase.rpc("admin_resolve_report" as any, { p_report_id: id, p_note: null });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success("Marked resolved"); load(); }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={tab === "open" ? "default" : "outline"} className="rounded-full" onClick={() => setTab("open")}>Open</Button>
        <Button size="sm" variant={tab === "resolved" ? "default" : "outline"} className="rounded-full" onClick={() => setTab("resolved")}>Resolved</Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No {tab} reports.</p>
      ) : (
        items.map((r) => (
          <div key={r.id} className="space-y-2 rounded-3xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Avatar name={r.reported_username ?? "?"} avatarPath={r.reported_avatar_url} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">@{r.reported_username ?? "unknown"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Reported by @{r.reporter_username ?? "unknown"} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </p>
              </div>
              <Flag className="h-4 w-4 text-koth-red" />
            </div>
            <p className="whitespace-pre-wrap rounded-2xl bg-muted/40 p-3 text-sm text-foreground">{r.reason}</p>
            {r.status === "open" ? (
              <div className="flex justify-end">
                <Button size="sm" disabled={busy === r.id} onClick={() => resolve(r.id)} className="rounded-full">
                  Mark resolved
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Resolved {r.resolved_at ? formatDistanceToNow(new Date(r.resolved_at), { addSuffix: true }) : ""}
                {r.resolution_note ? ` — ${r.resolution_note}` : ""}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
