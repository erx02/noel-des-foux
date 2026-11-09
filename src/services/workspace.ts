import type { RealtimeChannel } from "@supabase/supabase-js";
import { isAvatarId } from "../constants/avatars";
import { supabase } from "../lib/supabase";
import type { Workspace, WishInput } from "../types/app";
import { isUuid } from "../utils/validation";

function client() {
  if (!supabase) throw new Error("La connexion à Supabase n’est pas configurée.");
  return supabase;
}

export function readableError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    return "Ce cadeau vient d’être réservé. La liste a été actualisée.";
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const message = error.message.toLowerCase();
    if (message.includes("failed to fetch") || message.includes("network")) {
      return "Connexion indisponible. Vérifie ton réseau puis réessaie.";
    }
  }
  return "Une erreur est survenue. Réessaie dans un instant.";
}

export async function loadWorkspace(userId: string): Promise<Workspace> {
  const db = client();
  const { data: currentMember, error: memberError } = await db
    .from("family_members")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!currentMember) throw new Error("Ton compte n’est associé à aucune famille. Contacte l’administrateur.");

  const [familyResult, membersResult, wishesResult, reservationsResult] = await Promise.all([
    db.from("families").select("*").eq("id", currentMember.family_id).single(),
    db.from("family_members").select("*").eq("family_id", currentMember.family_id),
    db.from("wishes").select("*").eq("family_id", currentMember.family_id),
    db.from("reservations").select("*").eq("family_id", currentMember.family_id),
  ]);
  if (familyResult.error) throw familyResult.error;
  if (membersResult.error) throw membersResult.error;
  if (wishesResult.error) throw wishesResult.error;
  if (reservationsResult.error) throw reservationsResult.error;

  return {
    family: familyResult.data,
    members: membersResult.data,
    wishes: wishesResult.data,
    reservations: reservationsResult.data,
  };
}

export function subscribeToWorkspace(onChange: () => void): RealtimeChannel {
  return client()
    .channel("family-workspace")
    .on("postgres_changes", { event: "*", schema: "public", table: "families" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "family_members" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "wishes" }, onChange)
    .subscribe();
}

export async function saveWish(input: WishInput, wishId?: string): Promise<void> {
  const db = client();
  if (wishId) {
    if (!isUuid(wishId)) throw new Error("Identifiant de souhait invalide.");
    const { error } = await db.from("wishes").update(input).eq("id", wishId);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("wishes").insert(input);
  if (error) throw error;
}

export async function removeWish(wishId: string): Promise<void> {
  if (!isUuid(wishId)) throw new Error("Identifiant de souhait invalide.");
  const { error } = await client().from("wishes").delete().eq("id", wishId);
  if (error) throw error;
}

export async function reserveWish(wishId: string): Promise<void> {
  if (!isUuid(wishId)) throw new Error("Identifiant de souhait invalide.");
  const { error } = await client().from("reservations").insert({ wish_id: wishId });
  if (error) throw error;
}

export async function cancelReservation(wishId: string, userId: string): Promise<void> {
  if (!isUuid(wishId) || !isUuid(userId)) throw new Error("Identifiant invalide.");
  const { error } = await client()
    .from("reservations")
    .delete()
    .eq("wish_id", wishId)
    .eq("reserved_by", userId);
  if (error) throw error;
}

export async function updateFamilyMemberProfile(
  userId: string,
  displayName: string,
  avatarId: string,
): Promise<void> {
  if (!isUuid(userId)) throw new Error("Identifiant de compte invalide.");
  const trimmed = displayName.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new Error("Le prénom doit contenir entre 1 et 80 caractères.");
  }
  if (!isAvatarId(avatarId)) throw new Error("Choisis un avatar valide.");
  const { error } = await client()
    .from("family_members")
    .update({ display_name: trimmed, avatar_id: avatarId })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function renameFamily(familyId: string, name: string): Promise<void> {
  if (!isUuid(familyId)) throw new Error("Identifiant de famille invalide.");
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    throw new Error("Le nom doit contenir entre 1 et 100 caractères.");
  }
  const { error } = await client().from("families").update({ name: trimmed }).eq("id", familyId);
  if (error) throw error;
}

export async function addFamilyMember(
  familyId: string,
  userId: string,
  displayName: string,
): Promise<void> {
  if (!isUuid(familyId) || !isUuid(userId)) {
    throw new Error("Vérifie l’identifiant UUID du compte invité.");
  }
  const trimmed = displayName.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new Error("Le prénom doit contenir entre 1 et 80 caractères.");
  }
  const { error } = await client()
    .from("family_members")
    .insert({ family_id: familyId, user_id: userId, display_name: trimmed });
  if (error) throw error;
}

export async function removeFamilyMember(userId: string): Promise<void> {
  if (!isUuid(userId)) throw new Error("Identifiant de compte invalide.");
  const { error } = await client().from("family_members").delete().eq("user_id", userId);
  if (error) throw error;
}
