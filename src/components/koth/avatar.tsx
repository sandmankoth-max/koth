import { cn } from "@/lib/utils";
import { initials } from "@/lib/koth-utils";
import { useEffect, useState } from "react";
import { getAvatarSignedUrl, getCachedAvatarUrl } from "@/lib/koth-utils";

type Props = {
  name: string;
  avatarPath?: string | null;
  size?: number;
  className?: string;
};

/**
 * Default avatar = a solid koth-red circle with the user's initials in white.
 * Generated client-side so we never need a static placeholder asset.
 */
export function Avatar({ name, avatarPath, size = 40, className }: Props) {
  const [url, setUrl] = useState<string | null>(() => getCachedAvatarUrl(avatarPath ?? null));
  useEffect(() => {
    let active = true;
    if (avatarPath) {
      const cached = getCachedAvatarUrl(avatarPath);
      setUrl(cached);
      if (!cached) getAvatarSignedUrl(avatarPath).then((u) => active && setUrl(u));
    } else {
      setUrl(null);
    }
    return () => {
      active = false;
    };
  }, [avatarPath]);

  if (url) {
    return (
      <img
        src={url}
        alt={`${name} avatar`}
        width={size}
        height={size}
        loading="eager"
        decoding="async"
        // @ts-expect-error - non-standard but supported hint
        fetchpriority="high"
        className={cn("rounded-full bg-koth-red object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }


  return (
    <span
      aria-label={`${name} avatar`}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-koth-red font-bold text-koth-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name) || "K"}
    </span>
  );
}
