import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/koth/avatar";
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
};

export function ReportsPanel() {
  const [items, setItems] = useState<Report[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("admin_list_reports" as any, { p_status: null });
      if (error) { toast.error(error.message); return; }
      setItems((data ?? []) as Report[]);
    })();
  }, []);

  return (
    <div className="mt-4 space-y-3">
      {items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No reports yet.</p>
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
            <p className="text-[11px] text-muted-foreground">Handle any action in the Punish tab.</p>
          </div>
        ))
      )}
    </div>
  );
}
