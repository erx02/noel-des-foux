export const avatarOptions = [
  { id: "santa", emoji: "🎅", label: "Père Noël" },
  { id: "reindeer", emoji: "🦌", label: "Renne" },
  { id: "snowman", emoji: "⛄", label: "Bonhomme de neige" },
  { id: "tree", emoji: "🎄", label: "Sapin" },
  { id: "gift", emoji: "🎁", label: "Cadeau" },
  { id: "star", emoji: "⭐", label: "Étoile" },
  { id: "elf", emoji: "🧝", label: "Lutin" },
  { id: "cookie", emoji: "🍪", label: "Biscuit" },
] as const;

export type AvatarId = (typeof avatarOptions)[number]["id"];

export function isAvatarId(value: string): value is AvatarId {
  return avatarOptions.some((avatar) => avatar.id === value);
}

export function getAvatar(avatarId: string) {
  return avatarOptions.find((avatar) => avatar.id === avatarId) ?? avatarOptions[0];
}
