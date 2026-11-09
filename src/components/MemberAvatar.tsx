import { getAvatar } from "../constants/avatars";

interface MemberAvatarProps {
  avatarId: string;
  size: "profile" | "member";
}

export function MemberAvatar({ avatarId, size }: MemberAvatarProps) {
  const avatar = getAvatar(avatarId);

  return (
    <span className={`member-avatar member-avatar-${size}`} aria-hidden="true">
      {avatar.emoji}
    </span>
  );
}
