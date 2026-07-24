/**
 * Punish panel — Suspend users from posting to the challenge feed.
 * Friends-feed and recording still work. Existing pending submissions remain.
 * Accessible to admins + moderators.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Avatar } from "@/components/koth/avatar";
import { UsernamePicker, type PickedUser } from "@/components/koth/username-picker";
import { ShieldAlert, Ban, Clock, Edit2, X } from "lucide-react";

const PRESETS: Array<{ label: string; hours: number }> = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "3d", hours: 72 },
  { label: "7d", hours: 168 },
];

export function PunishPanel() {
  return (
    <div className="mt-4 space-y-3">
      <Tabs defaultValue="suspend">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="suspend">Suspend</TabsTrigger>
          <TabsTrigger value="ban">Ban</TabsTrigger>
          <TabsTrigger value="list">Suspended</TabsTrigger>
        </TabsList>
        <TabsContent value="suspend"><SuspendTab /></TabsContent>
        <TabsContent value="ban"><BanTab /></TabsContent>
        <TabsContent value="list"><SuspendedList /></TabsContent>
      </Tabs>
    </div>
  );
}

function SuspendTab() {
  const [user, setUser] = useState<PickedUser | null>(null);
  const [hours, setHours] = useState<number>(24);
  const [custom, setCustom] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!user) { toast.error("Pick a user"); return; }
    const h = custom ? Number(custom) : hours;
    if (!h || h <= 0) { toast.error("Enter a duration"); return; }
    const until = new Date(Date.now() + h * 3600 * 1000).toISOString();
    setBusy(true);
    const { error } = await supabase.rpc("admin_suspend_user" as any, {
      p_user_id: user.id, p_until: until, p_reason: reason || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Suspended @${user.username} for ${h}h`);
    setUser(null); setCustom(""); setReason("");
  }

  return (
    <div className="mt-3 space-y-4 rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-200">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Suspension blocks posting to the challenge feed only. Recording and the friends feed still work. Existing pending submissions stay in the grading queue.</p>
      </div>

      <div>
        <Label className="label-broadcast mb-1.5 block text-muted-foreground">User</Label>
        <UsernamePicker value={user} onChange={setUser} />
      </div>

      <div>
        <Label className="label-broadcast mb-1.5 block text-muted-foreground">Duration</Label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => { setHours(p.hours); setCustom(""); }}
              className={`tap-44 rounded-full border px-4 py-1.5 text-xs font-bold ${
                !custom && hours === p.hours ? "border-koth-red bg-koth-red text-white" : "border-border text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
          <Input
            type="number"
            min="1"
            placeholder="Custom hours"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="h-9 w-32 rounded-full"
          />
        </div>
      </div>

      <div>
        <Label className="label-broadcast mb-1.5 block text-muted-foreground">Reason</Label>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sent to the user in their notifications" />
      </div>

      <Button onClick={go} disabled={busy || !user} className="tap-44 h-12 w-full rounded-full bg-koth-red text-white">
        {busy ? "…" : "Suspend"}
      </Button>
    </div>
  );
}

function BanTab() {
  const [user, setUser] = useState<PickedUser | null>(null);
  const [reason, setReason] = useState("Inappropriate content");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!user || !reason.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_ban_user" as any, {
      p_user_id: user.id, p_reason: reason.trim(),
    });
    setBusy(false); setOpen(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Banned @${user.username}`);
    setUser(null);
  }

  return (
    <div className="mt-3 space-y-4 rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start gap-2 rounded-2xl bg-koth-red/10 p-3 text-xs text-koth-red">
        <Ban className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Permanent. Logs the user out, blocks the username from being reused, and bans their device.</p>
      </div>
      <div>
        <Label className="label-broadcast mb-1.5 block text-muted-foreground">User</Label>
        <UsernamePicker value={user} onChange={setUser} />
      </div>
      <div>
        <Label className="label-broadcast mb-1.5 block text-muted-foreground">Reason</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <Button onClick={() => setOpen(true)} disabled={!user || !reason.trim()} className="tap-44 h-12 w-full rounded-full bg-koth-red text-white">
        Ban user
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban @{user?.username}?</AlertDialogTitle>
            <AlertDialogDescription>This is permanent and cannot be undone here.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); go(); }}
              disabled={busy}
              className="bg-koth-red text-white hover:bg-koth-red/90"
            >
              {busy ? "…" : "Ban"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type SuspendedRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  suspended_until: string;
  suspension_reason: string | null;
};

function SuspendedList() {
  const [rows, setRows] = useState<SuspendedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SuspendedRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_suspended" as any);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as SuspendedRow[]);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function cancel(id: string, username: string) {
    const { error } = await supabase.rpc("admin_clear_suspension" as any, { p_user_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success(`Lifted @${username}'s suspension`);
    refresh();
  }

  if (loading) return <p className="mt-3 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Loading…</p>;
  if (rows.length === 0) return <p className="mt-3 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No active suspensions.</p>;

  return (
    <div className="mt-3 space-y-2">
      {rows.map((r) => {
        const ms = new Date(r.suspended_until).getTime() - Date.now();
        const h = Math.max(0, Math.floor(ms / 3600000));
        const m = Math.max(0, Math.floor((ms % 3600000) / 60000));
        const left = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h >= 1 ? `${h}h ${m}m` : `${m}m`;
        return (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <Avatar name={r.display_name ?? r.username} avatarPath={r.avatar_url} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">@{r.username}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {left} left
                </p>
              </div>
              <button onClick={() => setEditing(r)} className="tap-44 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted" aria-label="Edit">
                <Edit2 className="h-4 w-4" />
              </button>
              <button onClick={() => cancel(r.id, r.username)} className="tap-44 inline-flex h-8 w-8 items-center justify-center rounded-full text-koth-red hover:bg-koth-red/10" aria-label="Cancel">
                <X className="h-4 w-4" />
              </button>
            </div>
            {r.suspension_reason && (
              <p className="mt-2 rounded-xl bg-muted/40 p-2 text-xs text-muted-foreground">{r.suspension_reason}</p>
            )}
          </div>
        );
      })}
      {editing && <EditDialog row={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

function EditDialog({ row, onClose, onSaved }: { row: SuspendedRow; onClose: () => void; onSaved: () => void }) {
  const initialDate = new Date(row.suspended_until);
  const local = new Date(initialDate.getTime() - initialDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [until, setUntil] = useState(local);
  const [reason, setReason] = useState(row.suspension_reason ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_suspension" as any, {
      p_user_id: row.id,
      p_until: new Date(until).toISOString(),
      p_reason: reason || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    onClose(); onSaved();
  }

  return (
    <AlertDialog open onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit @{row.username}'s suspension</AlertDialogTitle>
          <AlertDialogDescription>Adjust the end time or reason.</AlertDialogDescription>
        </AlertDialogHeader>
        <Label className="label-broadcast text-muted-foreground">Ends at</Label>
        <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
        <Label className="label-broadcast text-muted-foreground">Reason</Label>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); save(); }}
            disabled={busy}
            className="bg-koth-red text-white hover:bg-koth-red/90"
          >
            {busy ? "…" : "Save"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
