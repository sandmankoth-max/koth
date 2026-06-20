import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/koth/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, UserPlus, X, Tv } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [{ title: "Friends — KOTH" }] }),
  component: Friends,
});

function Friends() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [accepted, setAccepted] = useState<any[]>([]);

  async function reload() {
    if (!user) return;
    const { data: rels } = await supabase
      .from("friendships")
      .select(
        "id, status, requester_id, addressee_id, req:profiles!friendships_requester_id_fkey(username, display_name, avatar_url), addr:profiles!friendships_addressee_id_fkey(username, display_name, avatar_url)",
      )
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const all = (rels as any[] | null) ?? [];
    setIncoming(all.filter((r) => r.status === "pending" && r.addressee_id === user.id));
    setOutgoing(all.filter((r) => r.status === "pending" && r.requester_id === user.id));
    setAccepted(all.filter((r) => r.status === "accepted"));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!q || q.length < 2 || !user) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .ilike("username", `%${q.toLowerCase()}%`)
        .neq("id", user.id)
        .limit(10);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, user]);

  async function send(addressee_id: string) {
    if (!user) return;
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: user.id, addressee_id, status: "pending" });
    if (error) toast.error(error.message);
    else {
      toast.success("Friend request sent");
      reload();
    }
  }

  async function accept(id: string) {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    reload();
  }

  async function remove(id: string) {
    await supabase.from("friendships").delete().eq("id", id);
    reload();
  }

  const acceptedIds = new Set(
    accepted.map((r) => (r.requester_id === user?.id ? r.addressee_id : r.requester_id)),
  );
  const pendingIds = new Set([
    ...outgoing.map((r) => r.addressee_id),
    ...incoming.map((r) => r.requester_id),
  ]);

  return (
    <div className="space-y-5">
      <section className="koth-stripe overflow-hidden rounded-3xl bg-koth-black p-5 text-koth-white">
        <p className="label-broadcast text-koth-white/60">Friends</p>
        <h1 className="mt-1 text-xl font-bold">Find your circle</h1>
      </section>

      <div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search usernames…"
          autoCapitalize="none"
          className="h-12 rounded-full"
        />
      </div>

      {results.length > 0 && (
        <Section title="Results">
          {results.map((p) => (
            <Row
              key={p.id}
              p={p}
              right={
                acceptedIds.has(p.id) ? (
                  <span className="pill bg-koth-pr-bg text-koth-pr-text">friends</span>
                ) : pendingIds.has(p.id) ? (
                  <span className="pill bg-muted text-muted-foreground">pending</span>
                ) : (
                  <Button
                    onClick={() => send(p.id)}
                    size="sm"
                    className="tap-44 rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90"
                  >
                    <UserPlus className="mr-1 h-4 w-4" aria-hidden />
                    Add
                  </Button>
                )
              }
            />
          ))}
        </Section>
      )}

      {incoming.length > 0 && (
        <Section title="Incoming requests">
          {incoming.map((r) => {
            const p = r.req;
            return (
              <Row
                key={r.id}
                p={{ ...p, id: r.requester_id }}
                right={
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => accept(r.id)}
                      className="tap-44 rounded-full bg-koth-red text-koth-white"
                    >
                      <Check className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => remove(r.id)}
                      className="tap-44 rounded-full"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                }
              />
            );
          })}
        </Section>
      )}

      {outgoing.length > 0 && (
        <Section title="Sent">
          {outgoing.map((r) => (
            <Row
              key={r.id}
              p={{ ...r.addr, id: r.addressee_id }}
              right={<span className="pill bg-muted text-muted-foreground">pending</span>}
            />
          ))}
        </Section>
      )}

      <Section title={`Friends · ${accepted.length}`}>
        {accepted.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">No friends yet.</p>
        ) : (
          accepted.map((r) => {
            const p = r.requester_id === user?.id ? r.addr : r.req;
            const pid = r.requester_id === user?.id ? r.addressee_id : r.requester_id;
            return (
              <Row
                key={r.id}
                p={{ ...p, id: pid }}
                right={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remove(r.id)}
                    className="tap-44 rounded-full"
                  >
                    Remove
                  </Button>
                }
              />
            );
          })
        )}
      </Section>

      <Link
        to="/feed"
        className="tap-44 flex items-center justify-center gap-2 rounded-full border border-border bg-card py-3 text-sm font-bold"
      >
        <Tv className="h-4 w-4" aria-hidden />
        Open friends feed
      </Link>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="label-broadcast text-muted-foreground">{title}</h2>
      <div className="rounded-3xl border border-border bg-card">
        <div className="divide-y divide-border">{children}</div>
      </div>
    </section>
  );
}

function Row({ p, right }: { p: any; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar name={p?.display_name ?? p?.username ?? "?"} avatarPath={p?.avatar_url} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{p?.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">@{p?.username}</p>
      </div>
      {right}
    </div>
  );
}
