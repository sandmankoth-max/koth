import { cn } from "@/lib/utils";
import { initials } from "@/lib/koth-utils";
import { useEffect, useState } from "react";
import { getAvatarSignedUrl } from "@/lib/koth-utils";

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
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (avatarPath) {
      getAvatarSignedUrl(avatarPath).then((u) => active && setUrl(u));
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
        className={cn("rounded-full object-cover", className)}
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
