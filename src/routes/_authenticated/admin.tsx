import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RankBadge } from "@/components/koth/rank-badge";
import { Avatar } from "@/components/koth/avatar";
import { formatValue, getVideoSignedUrl } from "@/lib/koth-utils";
import { toast } from "sonner";
import { AdminSubmissions } from "@/components/koth/admin-submissions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — KOTH" }] }),
  component: AdminGate,
});

function AdminGate() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/home" });
  }, [loading, isAdmin, navigate]);
  if (!isAdmin) return null;
  return <Admin />;
}

function Admin() {
  return (
    <div className="space-y-5">
      <section className="koth-stripe overflow-hidden rounded-3xl bg-koth-black p-5 text-koth-white">
        <p className="label-broadcast text-koth-red">Admin</p>
        <h1 className="mt-1 text-xl font-bold">Run the league</h1>
      </section>

      <Tabs defaultValue="create">
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="create" className="flex-1">Create</TabsTrigger>
          <TabsTrigger value="edit" className="flex-1">Edit</TabsTrigger>
          <TabsTrigger value="review" className="flex-1">Submissions</TabsTrigger>
          <TabsTrigger value="results" className="flex-1">Results</TabsTrigger>
          <TabsTrigger value="notify" className="flex-1">Notify</TabsTrigger>
        </TabsList>
        <TabsContent value="create"><CreateChallenge /></TabsContent>
        <TabsContent value="edit"><EditChallenge /></TabsContent>
        <TabsContent value="review"><AdminSubmissions /></TabsContent>
        <TabsContent value="results"><AnnounceWinners /></TabsContent>
        <TabsContent value="notify"><SendNotification /></TabsContent>
      </Tabs>
    </div>
  );
}

function CreateChallenge() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const nextMonday = nextMondayAt10();
  const nextSunday = nextSundayAt20(nextMonday);

  const [form, setForm] = useState({
    title: "",
    description: "",
    unit_type: "time_seconds" as "time_seconds" | "count_reps" | "custom",
    unit_label: "seconds",
    safety_note: "",
    starts_at: nextMonday.toISOString().slice(0, 16),
    ends_at: nextSunday.toISOString().slice(0, 16),
    prize_first: 100,
    prize_second: 20,
    prize_third: 10,
    max_video_seconds: 60,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const startsAt = new Date(form.starts_at);
      const isActiveNow = startsAt.getTime() <= Date.now();
      const status = isActiveNow ? "active" : "upcoming";

      // If activating immediately, supersede any prior active/closed challenges.
      if (isActiveNow) {
        const { error: supErr } = await supabase
          .from("challenges")
          .update({ status: "inactive" } as any)
          .in("status", ["active", "closed"]);
        if (supErr) throw supErr;
      }

      const { error } = await supabase
        .from("challenges")
        .insert({
          title: form.title,
          description: form.description || null,
          unit_type: form.unit_type,
          unit_label: form.unit_label,
          safety_note: form.safety_note || null,
          starts_at: startsAt.toISOString(),
          ends_at: new Date(form.ends_at).toISOString(),
          status,
          prize_first: form.prize_first,
          prize_second: form.prize_second,
          prize_third: form.prize_third,
          max_video_seconds: form.max_video_seconds || null,
          created_by: user.id,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      toast.success(isActiveNow ? "Challenge created and is now active." : "Challenge scheduled.");
      setForm((f) => ({ ...f, title: "", description: "", safety_note: "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-3xl border border-border bg-card p-5">
      <Field label="Title">
        <Input value={form.title} required onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea
          value={form.description}
          rows={3}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit type">
          <Select
            value={form.unit_type}
            onValueChange={(v) =>
              setForm({
                ...form,
                unit_type: v as any,
                unit_label: v === "time_seconds" ? "seconds" : v === "count_reps" ? "reps" : form.unit_label,
              })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="time_seconds">Time (seconds)</SelectItem>
              <SelectItem value="count_reps">Count (reps)</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Unit label">
          <Input value={form.unit_label} onChange={(e) => setForm({ ...form, unit_label: e.target.value })} />
        </Field>
      </div>
      <Field label="Safety note (optional)">
        <Textarea value={form.safety_note} rows={2} onChange={(e) => setForm({ ...form, safety_note: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts at">
          <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
        </Field>
        <Field label="Ends at">
          <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["prize_first", "1st $"],
          ["prize_second", "2nd $"],
          ["prize_third", "3rd $"],
        ].map(([k, l]) => (
          <Field key={k} label={l}>
            <Input
              type="number"
              min="0"
              value={(form as any)[k]}
              onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}
            />
          </Field>
        ))}
      </div>
      <Field label="Max video seconds (recording auto-stops here)">
        <Input
          type="number"
          min="5"
          max="300"
          value={form.max_video_seconds}
          onChange={(e) => setForm({ ...form, max_video_seconds: Number(e.target.value) })}
        />
      </Field>
      <Field label="Initial status">
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming (activates at start)</SelectItem>
            <SelectItem value="active">Active now</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Button type="submit" disabled={busy} className="tap-44 h-12 w-full rounded-full bg-koth-red text-koth-white">
        {busy ? "…" : "Create challenge"}
      </Button>
    </form>
  );
}

function ReviewSubmissions() {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [sel, setSel] = useState<string>("");
  const [subs, setSubs] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("challenges")
      .select("id, title, status")
      .order("starts_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setChallenges(data ?? []);
        const active = (data ?? []).find((c) => c.status === "active");
        if (active) setSel(active.id);
        else if (data?.[0]) setSel(data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!sel) return;
    supabase
      .from("submissions")
      .select(
        "*, profiles!submissions_user_id_fkey(username, display_name, avatar_url)",
      )
      .eq("challenge_id", sel)
      .eq("visibility", "public")
      .eq("is_active_entry", true)
      .eq("status", "pending_review")
      .order("submitted_at", { ascending: false })
      .then(({ data }) => setSubs(data ?? []));
  }, [sel]);

  async function update(id: string, patch: any) {
    if (patch.__local) {
      const { __local, ...rest } = patch;
      setSubs((cur) => cur.map((s) => (s.id === id ? { ...s, ...rest } : s)));
      return;
    }
    const { error } = await supabase.from("submissions").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      setSubs((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <Select value={sel} onValueChange={setSel}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {challenges.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              [{c.status}] {c.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {subs.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No submissions yet.
        </p>
      ) : (
        subs.map((s) => <SubmissionRow key={s.id} s={s} onUpdate={(p) => update(s.id, p)} />)
      )}
    </div>
  );
}

function SubmissionRow({ s, onUpdate }: { s: any; onUpdate: (p: any) => Promise<void> | void }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [verified, setVerified] = useState<string>(s.admin_verified_value?.toString() ?? "");
  useEffect(() => {
    getVideoSignedUrl(s.video_path).then(setVideoUrl);
  }, [s.video_path]);

  async function submitVerified() {
    const patch: any = {
      status: "verified",
      is_active_entry: true,
      admin_verified_value: verified === "" ? null : Number(verified),
    };
    await onUpdate(patch);
  }

  async function reset() {
    const { error } = await supabase.rpc("admin_restore_submission" as any, { p_submission_id: s.id });
    if (error) toast.error(error.message);
    else {
      toast.success("Restored to leaderboard");
      setVerified("");
      await onUpdate({
        status: "pending_review",
        is_active_entry: true,
        admin_verified_value: null,
        __local: true,
      });
    }
  }

  return (
    <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Avatar name={s.profiles?.display_name ?? s.profiles?.username} avatarPath={s.profiles?.avatar_url} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{s.profiles?.display_name}</p>
          <p className="truncate text-xs text-muted-foreground">@{s.profiles?.username}</p>
        </div>
        <span className={`pill ${
          s.status === "verified" ? "bg-koth-pr-bg text-koth-pr-text" :
          s.status === "disqualified" ? "bg-koth-red text-koth-white" :
          s.status === "flagged" ? "bg-koth-black text-koth-white" :
          "bg-muted text-muted-foreground"
        }`}>{s.status}</span>
      </div>
      {videoUrl && (
        <video src={videoUrl} controls playsInline className="aspect-[9/16] w-full rounded-xl bg-black" />
      )}
      <div className="grid grid-cols-2 items-end gap-3">
        <div>
          <p className="label-broadcast text-muted-foreground">Reported</p>
          <p className="mono-stat text-lg font-bold">{s.self_reported_value}</p>
        </div>
        <div>
          <Label className="label-broadcast text-muted-foreground">Adjusted value (optional)</Label>
          <Input
            type="number"
            step="any"
            placeholder="Leave blank to accept reported"
            value={verified}
            onChange={(e) => setVerified(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Submit accepts the reported time, or the adjusted value if you entered one. The leaderboard updates immediately.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={submitVerified} className="rounded-full bg-koth-red text-koth-white">
          Submit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const reason = window.prompt(
              "Why is this submission being suspended? This note will be sent to the user in their notification.",
              "",
            );
            if (reason === null) return;
            const { error } = await supabase.rpc("admin_disqualify_submission" as any, {
              p_submission_id: s.id,
              p_reason: reason.trim() || null,
            });
            if (error) toast.error(error.message);
            else {
              toast.success("Suspended");
              await onUpdate({ status: "disqualified", is_active_entry: false, __local: true });
            }
          }}
          className="rounded-full border-koth-red text-koth-red hover:bg-koth-red hover:text-koth-white"
        >
          Suspend
        </Button>
        <Button size="sm" variant="outline" onClick={reset} className="rounded-full">
          Reset
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const reason = window.prompt(
              `Ban @${s.profiles?.username}? This disqualifies their entries and permanently blocks the username from being reused. Reason:`,
              "Inappropriate content",
            );
            if (!reason) return;
            const { error } = await supabase.rpc("admin_ban_user" as any, {
              p_user_id: s.user_id,
              p_reason: reason,
            });
            if (error) toast.error(error.message);
            else {
              toast.success(`Banned @${s.profiles?.username}`);
              await onUpdate({ status: "disqualified", is_active_entry: false, __local: true });
            }
          }}
          className="rounded-full border-koth-red text-koth-red hover:bg-koth-red hover:text-koth-white"
        >
          Ban user
        </Button>
      </div>
    </div>
  );
}

function MarkPaid() {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [sel, setSel] = useState<string>("");
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("challenges")
      .select("id, title, status")
      .in("status", ["closed", "archived", "active"])
      .order("starts_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setChallenges(data ?? []);
        if (data?.[0]) setSel(data[0].id);
      });
  }, []);

  async function load(cid: string) {
    const { data } = await supabase
      .from("results")
      .select("*, profiles!results_user_id_fkey(username, display_name, avatar_url)")
      .eq("challenge_id", cid)
      .order("rank");
    setResults(data ?? []);
  }
  useEffect(() => {
    if (sel) load(sel);
  }, [sel]);

  async function togglePaid(id: string, paid: boolean) {
    await supabase.from("results").update({ paid }).eq("id", id);
    setResults((r) => r.map((x) => (x.id === id ? { ...x, paid } : x)));
  }

  return (
    <div className="mt-4 space-y-3">
      <Select value={sel} onValueChange={setSel}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {challenges.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              [{c.status}] {c.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="divide-y divide-border rounded-3xl border border-border bg-card">
        {results.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No results recorded.</p>
        ) : (
          results.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3">
              <RankBadge rank={r.rank} size="md" />
              <Avatar name={r.profiles?.display_name} avatarPath={r.profiles?.avatar_url} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.profiles?.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">@{r.profiles?.username}</p>
              </div>
              <div className="mono-stat text-sm font-bold">${Number(r.prize_amount)}</div>
              <Button
                size="sm"
                variant={r.paid ? "outline" : "default"}
                onClick={() => togglePaid(r.id, !r.paid)}
                className={`rounded-full ${r.paid ? "" : "bg-koth-red text-koth-white"}`}
              >
                {r.paid ? "Paid ✓" : "Mark paid"}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ManageChallenges() {
  const [items, setItems] = useState<any[]>([]);
  async function load() {
    const { data } = await supabase
      .from("challenges")
      .select("id, title, status, starts_at, ends_at")
      .in("status", ["active", "upcoming"])
      .order("starts_at");
    setItems(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function closeNow(id: string) {
    if (!confirm("Close this challenge now? Final results will be computed.")) return;
    const { error } = await supabase.rpc("close_challenge" as any, { p_challenge_id: id });
    if (error) toast.error(error.message);
    else {
      toast.success("Challenge closed & results computed");
      load();
    }
  }

  async function cancelChallenge(id: string) {
    if (!confirm("Delete this scheduled challenge? This cannot be undone.")) return;
    const { error } = await supabase.from("challenges").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed");
      load();
    }
  }

  if (items.length === 0) return null;
  return (
    <div className="mt-4 rounded-3xl border border-border bg-card p-5">
      <p className="label-broadcast text-muted-foreground mb-3">Active & upcoming</p>
      <div className="divide-y divide-border">
        {items.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{c.title}</p>
              <p className="text-xs text-muted-foreground">
                {c.status} · starts {new Date(c.starts_at).toLocaleString()}
              </p>
            </div>
            {c.status === "active" ? (
              <Button size="sm" variant="outline" onClick={() => closeNow(c.id)} className="rounded-full">
                Close now
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => cancelChallenge(c.id)} className="rounded-full">
                Cancel
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="label-broadcast text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function EditChallenge() {
  const [items, setItems] = useState<any[]>([]);
  const [sel, setSel] = useState<string>("");
  const [form, setForm] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("challenges")
      .select("*")
      .order("starts_at", { ascending: false })
      .limit(50);
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const c = items.find((x) => x.id === sel);
    if (!c) { setForm(null); return; }
    setForm({
      title: c.title ?? "",
      description: c.description ?? "",
      safety_note: c.safety_note ?? "",
      unit_label: c.unit_label ?? "",
      starts_at: new Date(c.starts_at).toISOString().slice(0, 16),
      ends_at: new Date(c.ends_at).toISOString().slice(0, 16),
      prize_first: c.prize_first ?? 0,
      prize_second: c.prize_second ?? 0,
      prize_third: c.prize_third ?? 0,
      max_video_seconds: c.max_video_seconds ?? "",
    });
  }, [sel, items]);

  async function save() {
    if (!sel || !form) return;
    setBusy(true);
    const { error } = await supabase
      .from("challenges")
      .update({
        title: form.title,
        description: form.description || null,
        safety_note: form.safety_note || null,
        unit_label: form.unit_label,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        prize_first: Number(form.prize_first),
        prize_second: Number(form.prize_second),
        prize_third: Number(form.prize_third),
        max_video_seconds: form.max_video_seconds === "" ? null : Number(form.max_video_seconds),
      } as any)
      .eq("id", sel);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Challenge updated"); load(); }
  }

  return (
    <div className="mt-4 space-y-3">
      <Select value={sel} onValueChange={setSel}>
        <SelectTrigger><SelectValue placeholder="Pick a challenge to edit" /></SelectTrigger>
        <SelectContent>
          {items.map((c) => (
            <SelectItem key={c.id} value={c.id}>[{c.status}] {c.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {form && (
        <div className="space-y-3 rounded-3xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">
            Editing details does not delete submissions, videos, or leaderboard entries.
          </p>
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Safety note">
            <Textarea rows={2} value={form.safety_note} onChange={(e) => setForm({ ...form, safety_note: e.target.value })} />
          </Field>
          <Field label="Unit label">
            <Input value={form.unit_label} onChange={(e) => setForm({ ...form, unit_label: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts at">
              <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </Field>
            <Field label="Ends at">
              <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="1st $">
              <Input type="number" min="0" value={form.prize_first} onChange={(e) => setForm({ ...form, prize_first: e.target.value })} />
            </Field>
            <Field label="2nd $">
              <Input type="number" min="0" value={form.prize_second} onChange={(e) => setForm({ ...form, prize_second: e.target.value })} />
            </Field>
            <Field label="3rd $">
              <Input type="number" min="0" value={form.prize_third} onChange={(e) => setForm({ ...form, prize_third: e.target.value })} />
            </Field>
          </div>
          <Field label="Max video seconds (blank = no cap)">
            <Input
              type="number"
              min="5"
              max="300"
              placeholder="e.g. 60"
              value={form.max_video_seconds}
              onChange={(e) => setForm({ ...form, max_video_seconds: e.target.value })}
            />
          </Field>
          <Button onClick={save} disabled={busy} className="tap-44 h-12 w-full rounded-full bg-koth-red text-koth-white">
            {busy ? "…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}

function SendNotification() {
  const [mode, setMode] = useState<"user" | "all">("user");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [picked, setPicked] = useState<{ id: string; username: string; display_name: string | null; avatar_url: string | null } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  // Username autocomplete (debounced) — same shape as the friends search.
  useEffect(() => {
    if (mode !== "user") return;
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (q.length < 1) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .ilike("username", `%${q}%`)
        .limit(8);
      setResults(data ?? []);
    }, 150);
    return () => clearTimeout(t);
  }, [query, mode]);

  async function sendToUser() {
    const msg = message.trim();
    if (!msg) { toast.error("Enter a message"); return; }
    if (!picked) { toast.error("Pick a user from the list"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_send_notification" as any, {
        p_user_id: picked.id, p_message: msg,
      });
      if (error) throw error;
      toast.success(`Sent to @${picked.username}`);
      setMessage(""); setQuery(""); setPicked(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  async function sendBroadcast() {
    const msg = message.trim();
    if (!msg) { toast.error("Enter a message"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("admin_broadcast_notification" as any, { p_message: msg });
      if (error) throw error;
      toast.success(`Sent to ${data ?? 0} users`);
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); setBroadcastOpen(false); }
  }

  return (
    <div className="mt-4 space-y-3 rounded-3xl border border-border bg-card p-5">
      <Tabs value={mode} onValueChange={(v) => { setMode(v as any); setResults([]); setPicked(null); setQuery(""); }}>
        <TabsList className="w-full">
          <TabsTrigger value="user" className="flex-1">To one user</TabsTrigger>
          <TabsTrigger value="all" className="flex-1">Broadcast all</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "user" && (
        <Field label="Recipient">
          {picked ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-2">
              <Avatar name={picked.display_name ?? picked.username} avatarPath={picked.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{picked.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">@{picked.username}</p>
              </div>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => { setPicked(null); setQuery(""); }}>
                Change
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Search username…"
                autoCapitalize="none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
                className="h-11 rounded-full"
              />
              {showResults && results.length > 0 && (
                <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-border bg-popover p-1 shadow-lg">
                  {results.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setPicked(u); setQuery(""); setResults([]); }}
                      className="tap-44 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
                    >
                      <Avatar name={u.display_name ?? u.username} avatarPath={u.avatar_url} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{u.display_name}</p>
                        <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>
      )}

      <Field label="Message">
        <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your notification…" />
      </Field>

      <Button
        onClick={mode === "all" ? () => setBroadcastOpen(true) : sendToUser}
        disabled={busy}
        className="tap-44 h-12 w-full rounded-full bg-koth-red text-koth-white"
      >
        {busy ? "…" : mode === "all" ? "Send to everyone" : "Send"}
      </Button>

      <AlertDialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Broadcast to every user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deliver the notification to every account on the platform. Make sure the message is correct.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); sendBroadcast(); }}
              disabled={busy}
              className="bg-koth-red text-koth-white hover:bg-koth-red/90"
            >
              {busy ? "…" : "Send to everyone"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function nextMondayAt10() {
  const d = new Date();
  const day = d.getDay();
  const diff = (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(10, 0, 0, 0);
  return d;
}
function nextSundayAt20(monday: Date) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(20, 0, 0, 0);
  return d;
}
