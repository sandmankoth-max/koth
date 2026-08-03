import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/koth/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Settings, LogOut, Camera, FileText, ShieldCheck, Pencil, Check,
  Bell, Users, Trash2, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { TikTokPlayer, type PlayerItem } from "@/components/koth/tiktok-player";
import { VideoThumb } from "@/components/koth/video-thumb";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useServerFn } from "@tanstack/react-start";
import { deleteOwnAccount } from "@/lib/account.functions";
import { primeAvatarSignedUrl } from "@/lib/koth-utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — KOTH" }] }),
  component: Profile,
});

function Profile() {
  const { user, profile, isAdmin, isStaff, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(profile?.bio ?? "");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const callDeleteAccount = useServerFn(deleteOwnAccount);

  useEffect(() => { setBioDraft(profile?.bio ?? ""); }, [profile?.bio]);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    setUploading(true);
    try {
      const ext = f.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("koth-avatars")
        .upload(path, f, { contentType: f.type, upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("koth-avatars").createSignedUrl(path, 3600);
      primeAvatarSignedUrl(path, signed?.signedUrl ?? null);
      await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      await refreshProfile();
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally { setUploading(false); }
  }

  async function saveBio() {
    if (!user) return;
    const trimmed = bioDraft.trim();
    const { isProfane } = await import("@/lib/profanity");
    if (isProfane(trimmed)) { toast.error("Your bio contains language we don't allow."); return; }
    const { error } = await supabase.from("profiles")
      .update({ bio: trimmed.length ? trimmed : null }).eq("id", user.id);
    if (error) toast.error(error.message);
    else { await refreshProfile(); toast.success("Bio saved"); setEditingBio(false); }
  }

  const friendCountQ = useQuery({
    queryKey: ["friend-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase.from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("status", "accepted")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      return count ?? 0;
    },
  });

  return (
    <div className="-mt-2 space-y-3">
      {/* Settings gear (icon only, no border) */}
      <div className="flex justify-end">
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="tap-44 inline-flex h-8 w-8 items-center justify-center text-foreground"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Centered identity — compact */}
      <section className="flex flex-col items-center text-center">
        <button
          onClick={() => fileRef.current?.click()}
          className="tap-44 relative inline-flex items-center justify-center rounded-full"
          aria-label="Change avatar"
        >
          <Avatar
            name={profile?.display_name ?? profile?.username ?? "?"}
            avatarPath={profile?.avatar_url}
            size={88}
          />
          <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-koth-red text-koth-white ring-2 ring-background">
            <Camera className="h-3 w-3" aria-hidden />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />

        <h1 className="mt-2 text-base font-bold text-foreground">{profile?.display_name}</h1>
        <p className="text-xs text-muted-foreground">@{profile?.username}</p>
        {uploading && <p className="mt-1 text-[10px] text-muted-foreground">Uploading…</p>}

        {/* Friends count + share-my-profile link */}
        <div className="mt-2 flex items-center justify-center gap-2">
        <button
          onClick={() => setFriendsOpen(true)}
          className="tap-44 inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground"
        >
          <Users className="h-3.5 w-3.5 text-koth-red" />
          <span className="mono-stat font-bold">{friendCountQ.data ?? 0}</span>
          <span className="text-muted-foreground">friends</span>
        </button>
        <ShareProfileButton username={profile?.username} />
        </div>



        {/* Bio — narrower, smaller */}
        <div className="mt-2 w-full max-w-[240px]">
          {editingBio ? (
            <div className="space-y-2">
              <Textarea
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                placeholder="Tell people what you're about…"
                maxLength={160}
                rows={2}
                className="resize-none rounded-2xl text-xs"
              />
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { setBioDraft(profile?.bio ?? ""); setEditingBio(false); }} className="h-7 rounded-full text-xs">
                  Cancel
                </Button>
                <Button size="sm" onClick={saveBio} className="h-7 rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90 text-xs">
                  <Check className="mr-1 h-3 w-3" /> Save
                </Button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditingBio(true)} className="tap-44 flex w-full items-center justify-center gap-2 text-center text-xs text-foreground/85">
              <span className="line-clamp-2">{profile?.bio || <span className="text-muted-foreground">Add a bio…</span>}</span>
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </section>

      {/* Gallery */}
      <VideoGallery />

      {/* Settings sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent aria-describedby={undefined} side="right" className="w-[88%] max-w-sm border-l border-border bg-card p-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="text-left text-foreground">Settings</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col">
            <SheetRow onClick={() => { setSettingsOpen(false); navigate({ to: "/notifications" }); }} icon={<Bell className="h-4 w-4" />} label="Notifications" />
            <SheetRow onClick={() => { setSettingsOpen(false); navigate({ to: "/legal/rules" }); }} icon={<FileText className="h-4 w-4" />} label="Official Rules" />
            <SheetRow onClick={() => { setSettingsOpen(false); navigate({ to: "/legal/terms" }); }} icon={<FileText className="h-4 w-4" />} label="Terms of Service" />
            <SheetRow onClick={() => { setSettingsOpen(false); navigate({ to: "/legal/privacy" }); }} icon={<FileText className="h-4 w-4" />} label="Privacy Policy" />
            {isStaff && (
              <SheetRow onClick={() => { setSettingsOpen(false); navigate({ to: "/admin" }); }} icon={<ShieldCheck className="h-4 w-4 text-koth-red" />} label={isAdmin ? "Admin panel" : "Moderator panel"} />
            )}
            <button
              onClick={async () => { await signOut(); navigate({ to: "/" }); }}
              className="tap-44 flex w-full items-center gap-3 border-t border-border px-5 py-4 text-left text-sm font-semibold text-koth-red"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
            <button
              onClick={() => { setSettingsOpen(false); setDeleteOpen(true); }}
              className="tap-44 flex w-full items-center gap-3 border-t border-border px-5 py-4 text-left text-sm font-semibold text-koth-red"
            >
              <Trash2 className="h-4 w-4" /> Delete account
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your profile, videos, submissions, friendships, and
              notifications. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                setDeleting(true);
                try {
                  await callDeleteAccount();
                  await signOut();
                  setDeleteOpen(false);
                  toast.success("Account deleted");
                  navigate({ to: "/" });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to delete account");
                  setDeleting(false);
                }
              }}
              className="rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90"
            >
              {deleting ? "Deleting…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FriendsDialog open={friendsOpen} onOpenChange={setFriendsOpen} userId={user?.id ?? null} canView={true} />
    </div>
  );
}

function SheetRow({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="tap-44 flex w-full items-center gap-3 border-b border-border px-5 py-4 text-left text-sm font-semibold text-foreground hover:bg-muted">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

function VideoGallery() {
  const { user, profile } = useAuth();
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(0);

  const videosQ = useQuery({
    queryKey: ["my-videos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("submissions").select(
        "id, video_path, self_reported_value, admin_verified_value, submitted_at, visibility, is_active_entry, status, admin_color, challenges(id, title, unit_type, unit_label)",
      ).eq("user_id", user!.id).order("submitted_at", { ascending: false });
      return (data ?? []).filter((s: any) =>
        s.challenges && (s.visibility === "friends_only" || s.is_active_entry || s.status === "disqualified"),
      );
    },
  });

  const items: PlayerItem[] = (videosQ.data ?? []).map((s: any) => ({
    id: s.id,
    video_path: s.video_path,
    value: Number(s.admin_verified_value ?? s.self_reported_value),
    unit_type: s.challenges?.unit_type,
    unit_label: s.challenges?.unit_label,
    challenge_title: s.challenges?.title,
    on_leaderboard: !!s.is_active_entry && s.status === "verified",
    admin_color: s.admin_color,
    user: {
      id: user!.id,
      username: profile?.username ?? "you",
      display_name: profile?.display_name,
      avatar_url: profile?.avatar_url,
    },
  }));

  return (
    <section>
      {videosQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No videos yet. Your submissions will show up here.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((it, i) => {
            const s: any = videosQ.data?.[i];
            const title = s?.challenges?.title as string | undefined;
            return (
              <div key={it.id} className="relative">
                <VideoThumb
                  videoPath={it.video_path}
                  className="overflow-hidden rounded-xl border border-border/60 shadow-sm"
                  onClick={() => { setPlayerIndex(i); setPlayerOpen(true); }}
                  badge={
                    s?.status === "disqualified" ? (
                      <span className="rounded-full bg-koth-red px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Rejected</span>
                    ) : s?.visibility === "friends_only" ? (
                      <span className="rounded-full bg-koth-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-koth-white">Friends</span>
                    ) : s?.status === "verified" ? (
                      <span className="rounded-full bg-koth-pr-bg px-1.5 py-0.5 text-[9px] font-bold uppercase text-koth-pr-text">Verified</span>
                    ) : (
                      <span className="rounded-full bg-koth-red/85 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Attempt</span>
                    )
                  }
                />
                {title && (
                  <div className="pointer-events-none absolute inset-x-1 bottom-1 rounded-md bg-black/60 px-1.5 py-0.5 text-center backdrop-blur">
                    <p className="truncate text-[10px] font-bold uppercase tracking-wide text-white">{title}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <TikTokPlayer items={items} startIndex={playerIndex} open={playerOpen} onOpenChange={setPlayerOpen} />
    </section>
  );
}

export function FriendsDialog({
  open, onOpenChange, userId, canView,
}: { open: boolean; onOpenChange: (v: boolean) => void; userId: string | null; canView: boolean }) {
  const { user } = useAuth();
  const isOwner = !!user && user.id === userId;
  const friendsQ = useQuery({
    queryKey: ["friends-list", userId],
    enabled: open && !!userId && canView,
    queryFn: async () => {
      const { data } = await supabase.rpc("friend_list", { _user: userId as string });
      return (data ?? []).map((r: any) => ({
        friendshipId: r.friendship_id,
        id: r.id,
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
      }));
    },
  });


  async function removeFriend(friendshipId: string) {
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
    if (error) toast.error(error.message);
    else {
      toast.success("Friend removed");
      friendsQ.refetch();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-sm">
        <DialogTitle>Friends</DialogTitle>
        {!canView ? (
          <p className="text-sm text-muted-foreground">Only friends of this user can see their friends list.</p>
        ) : friendsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (friendsQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No friends yet.</p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {friendsQ.data!.map((f: any) => (
              <li key={f.id} className="flex items-center gap-2">
                <Link
                  to="/u/$username"
                  params={{ username: f.username }}
                  onClick={() => onOpenChange(false)}
                  className="tap-44 flex flex-1 items-center gap-3 px-1 py-2"
                >
                  <Avatar name={f.display_name ?? f.username} avatarPath={f.avatar_url} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{f.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{f.username}</p>
                  </div>
                </Link>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeFriend(f.friendshipId)}
                    className="tap-44 rounded-full"
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Shares a link that auto-sends a friend request when the recipient opens it.
 * Uses the native share sheet on iOS, falls back to clipboard on the web.
 */
function ShareProfileButton({ username }: { username?: string | null }) {
  async function share() {
    if (!username) return;
    const url = `${window.location.origin}/u/${username}?add=1`;
    const text = `Add me on KOTH: @${username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "KOTH", text, url });
        return;
      }
    } catch {
      return; // user dismissed the share sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <button
      onClick={share}
      className="tap-44 inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground"
      aria-label="Share your profile"
    >
      <Share2 className="h-3.5 w-3.5 text-koth-red" />
      Share
    </button>
  );
}
