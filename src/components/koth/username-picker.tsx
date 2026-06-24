import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/koth/avatar";

export type PickedUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Snap-style typeahead username picker. Debounced query to profiles.
 * Used in Punish panel and Winners announce form.
 */
export function UsernamePicker({
  value,
  onChange,
  placeholder = "Search username…",
}: {
  value: PickedUser | null;
  onChange: (u: PickedUser | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedUser[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (q.length < 1) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .ilike("username", `%${q}%`)
        .limit(8);
      setResults((data ?? []) as PickedUser[]);
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-2">
        <Avatar name={value.display_name ?? value.username} avatarPath={value.avatar_url} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{value.display_name ?? value.username}</p>
          <p className="truncate text-xs text-muted-foreground">@{value.username}</p>
        </div>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => { onChange(null); setQuery(""); }}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        className="h-11 rounded-full"
      />
      {show && results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-border bg-popover p-1 shadow-lg">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(u); setQuery(""); setResults([]); }}
              className="tap-44 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
            >
              <Avatar name={u.display_name ?? u.username} avatarPath={u.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{u.display_name ?? u.username}</p>
                <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
