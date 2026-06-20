import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/koth/avatar";

type Props = {
  username?: string | null;
  name: string;
  avatarPath?: string | null;
  size?: number;
  className?: string;
  stopPropagation?: boolean;
};

/**
 * Tappable avatar that links to /u/$username. Falls back to plain Avatar
 * when we don't have a username to route to.
 */
export function ProfileAvatar({
  username,
  name,
  avatarPath,
  size = 40,
  className,
  stopPropagation = true,
}: Props) {
  if (!username) {
    return <Avatar name={name} avatarPath={avatarPath} size={size} className={className} />;
  }
  return (
    <Link
      to="/u/$username"
      params={{ username }}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
      }}
      className="tap-44 inline-flex shrink-0 rounded-full"
      aria-label={`Open @${username}'s profile`}
    >
      <Avatar name={name} avatarPath={avatarPath} size={size} className={className} />
    </Link>
  );
}
