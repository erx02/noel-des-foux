import type { User } from "@supabase/supabase-js";
import type { AvatarId } from "../constants/avatars";
import type { Database } from "./database";

export type Family = Database["public"]["Tables"]["families"]["Row"];
export type FamilyMember = Database["public"]["Tables"]["family_members"]["Row"];
export type Wish = Database["public"]["Tables"]["wishes"]["Row"];
export type Reservation = Database["public"]["Tables"]["reservations"]["Row"];

export interface Workspace {
  family: Family;
  members: FamilyMember[];
  wishes: Wish[];
  reservations: Reservation[];
}

export type AppUser = User;

export interface WishInput {
  title: string;
  description: string | null;
  product_url: string | null;
  image_url: string | null;
}

export type { AvatarId };
